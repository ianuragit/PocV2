import { Vector3 } from 'three';
import { createGame, type Difficulty, type Game, type GameEvent, type Tuning, type Vec3 } from './sim';
import { Hud } from './ui/hud';
import { Screens } from './ui/screens';
import { ActorsView } from './view/actorView';
import type { GameData } from './view/data';
import { InputCapture } from './view/input';
import { Overlay } from './view/overlay';
import { Renderer } from './view/renderer';
import { buildStageView } from './view/stageView';

export interface AppOptions {
  data: GameData;
  difficulty: Difficulty;
  seed: number;
  startStop: number;
  god: boolean;
  debug: boolean;
}

const MAX_STEPS_PER_FRAME = 5;
const RESULTS_DELAY = 1.2; // seconds between the last event and the results screen
const EVENT_LOG_SIZE = 500;

/** Wires the simulation to the view: fixed-step loop, screens, input, pause on blur. */
export class App {
  readonly renderer: Renderer;
  readonly overlay: Overlay;
  readonly input: InputCapture;
  readonly screens = new Screens();
  readonly hud = new Hud();
  readonly actors: ActorsView;
  readonly tuning: Tuning;
  game!: Game;
  /** Recent events, newest last. Read by tests and the debug overlay. */
  readonly eventLog: GameEvent[] = [];
  /** When true the loop renders but does not step the simulation (tests). */
  hold = false;

  private readonly stepSeconds: number;
  private accumulator = 0;
  private lastTime = 0;
  private prevCamera: Vec3 = { x: 0, y: 0, z: 0 };
  private endTimer = -1;
  private stageBuilt = false;

  constructor(private readonly opts: AppOptions) {
    this.tuning = opts.data.tuning;
    const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
    const stageEl = document.querySelector<HTMLElement>('#stage')!;
    this.renderer = new Renderer(canvas);
    this.overlay = new Overlay(document.querySelector<HTMLCanvasElement>('#overlay')!, opts.data.tuning);
    this.actors = new ActorsView(opts.data.tuning);
    this.renderer.scene.add(this.actors.root);
    this.stepSeconds = 1 / opts.data.tuning.step_hz;
    this.input = new InputCapture(stageEl, this.renderer.camera, { onAction: (a) => this.onAction(a) });

    this.newGame(opts.startStop);
    this.screens.show('title');

    const onHidden = () => this.pauseIfPlaying();
    window.addEventListener('blur', onHidden);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) onHidden();
    });
    requestAnimationFrame((t) => this.frame(t));
  }

  newGame(startStop = this.opts.startStop): void {
    this.game = createGame({
      stage: this.opts.data.stage,
      markers: this.opts.data.markers,
      tuning: this.opts.data.tuning,
      difficulty: this.opts.difficulty,
      seed: this.opts.seed,
      startStop,
      god: this.opts.god,
    });
    if (!this.stageBuilt) {
      const spawns = this.game.stage.stops.flatMap((stop) => stop.waves.flat().map((sp) => sp.position));
      this.renderer.scene.add(buildStageView(this.game.stage, spawns));
      this.stageBuilt = true;
    }
    this.prevCamera = this.game.state.camera.position;
    this.renderer.resetLook();
    this.input.drain();
    this.accumulator = 0;
    this.endTimer = -1;
    this.hud.reset();
    this.overlay.clearEffects();
  }

  start(): void {
    this.screens.show('playing');
    this.hud.show(true);
    if (!this.opts.debug) document.documentElement.requestFullscreen?.().catch(() => undefined);
  }

  /** Runs simulation steps now, outside the frame loop, and renders the result. */
  stepFrames(n: number): GameEvent[] {
    const all: GameEvent[] = [];
    for (let i = 0; i < n; i++) all.push(...this.step());
    this.draw(0, 1);
    return all;
  }

  private step(): GameEvent[] {
    this.prevCamera = this.game.state.camera.position;
    const events = this.game.step(this.input.drain());
    if (events.length > 0) {
      this.eventLog.push(...events);
      if (this.eventLog.length > EVENT_LOG_SIZE)
        this.eventLog.splice(0, this.eventLog.length - EVENT_LOG_SIZE);
      this.hud.onEvents(events, this.input.pointer);
      this.onEvents(events);
    }
    return events;
  }

  private onEvents(events: readonly GameEvent[]): void {
    const at = this.input.pointer;
    for (const e of events) {
      if (e.type === 'EnemyHit') this.overlay.burst(at, 'hit');
      else if (e.type === 'CivilianHit') this.overlay.burst(at, 'civilian');
      else if (e.type === 'Miss' || e.type === 'CoverHit') this.overlay.burst(at, 'miss');
      if (e.type === 'Paused' && this.screens.current === 'playing') this.screens.show('paused');
      else if (e.type === 'Resumed' && this.screens.current === 'paused') this.screens.show('playing');
      else if (e.type === 'GameOver' || e.type === 'StageCleared') this.endTimer = RESULTS_DELAY;
    }
  }

  /** Menu handling for clicks and keys. Returns true when the event was used by a menu. */
  onAction(action: 'click' | 'pause' | 'fullscreen'): boolean {
    if (action === 'fullscreen') {
      if (document.fullscreenElement) void document.exitFullscreen();
      else document.documentElement.requestFullscreen?.().catch(() => undefined);
      return true;
    }
    const screen = this.screens.current;
    if (action === 'pause') return screen !== 'playing' && screen !== 'paused';
    // Clicks on a menu are swallowed; on the playfield they become shots.
    if (screen === 'title') {
      this.start();
      return true;
    }
    if (screen === 'paused') {
      this.input.queuePause();
      return true;
    }
    if (screen === 'results') {
      this.newGame();
      this.start();
      return true;
    }
    return screen !== 'playing';
  }

  private pauseIfPlaying(): void {
    if (this.screens.current !== 'playing' || this.game.state.paused) return;
    this.input.drain();
    this.input.queuePause();
    this.step();
    this.accumulator = 0;
  }

  private frame(now: number): void {
    const dt = this.lastTime === 0 ? 0 : Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    if (this.screens.current === 'playing' && !this.hold) {
      this.accumulator += dt;
      let steps = 0;
      while (this.accumulator >= this.stepSeconds && steps < MAX_STEPS_PER_FRAME) {
        this.step();
        this.accumulator -= this.stepSeconds;
        steps++;
      }
      // After a long stall, drop the backlog rather than fast-forwarding through it.
      if (steps === MAX_STEPS_PER_FRAME) this.accumulator = 0;
    } else if (this.screens.current === 'paused') {
      // Inputs queued on the pause screen (resume) still need a step to take effect.
      this.step();
    }

    if (this.endTimer > 0) {
      this.endTimer -= dt;
      if (this.endTimer <= 0) {
        const s = this.game.state;
        this.hud.show(false);
        this.screens.show('results', {
          score: s.score.score,
          cleared: s.phase === 'stageClear',
          accuracy: s.score.shots === 0 ? 0 : Math.round((s.score.hits / s.score.shots) * 100),
        });
      }
    }

    this.draw(dt, this.accumulator / this.stepSeconds);
    requestAnimationFrame((t) => this.frame(t));
  }

  private draw(dt: number, alpha: number): void {
    const s = this.game.state;
    const a = Math.min(1, Math.max(0, alpha));
    const prev = new Vector3(this.prevCamera.x, this.prevCamera.y, this.prevCamera.z);
    const cur = new Vector3(s.camera.position.x, s.camera.position.y, s.camera.position.z);
    const pos = prev.lerp(cur, a);
    this.renderer.placeCamera(pos, s.camera.lookAt, dt);
    this.actors.sync(s.actors, dt, this.opts.debug);
    this.renderer.render();
    const playing = this.screens.current === 'playing';
    const pointer = this.input.pointer;
    this.overlay.draw({
      dt,
      camera: this.renderer.camera,
      rings: playing || this.screens.current === 'paused' ? s.rings : [],
      actors: s.actors,
      pointer,
      showCrosshair: playing,
      borderZone: pointer !== null && this.input.inBorderZone(pointer),
      debug: this.opts.debug,
    });
    this.hud.update(s, dt);
  }
}
