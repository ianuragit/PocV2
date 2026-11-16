import { Mesh, Vector3, type Object3D } from 'three';
import {
  createGame,
  type Difficulty,
  type Game,
  type GameEvent,
  type Tuning,
  type Vec3,
} from './sim/index.ts';
import { weaponSpecs, type WeaponSpec } from './sim/weapons.ts';
import { SaveStore } from './save/saveStore.ts';
import { Hud } from './ui/hud.ts';
import { DEFAULT_ACTION, Screens } from './ui/screens.ts';
import { ActorsView } from './view/actorView.ts';
import { AudioDirector } from './view/audio.ts';
import type { GameData } from './view/data.ts';
import { InputCapture } from './view/input.ts';
import { Overlay } from './view/overlay.ts';
import { Renderer } from './view/renderer.ts';
import { buildStageView } from './view/stageView.ts';

export interface StageInfo {
  id: string;
  name: string;
}

export interface AppOptions {
  data: GameData;
  stageId: string;
  stageName: string;
  /** Every stage in play order, from data/stages/index.json. */
  catalog: StageInfo[];
  /** Downloads a stage's data and model, reporting progress 0..1. */
  loadStage: (id: string, onProgress: (fraction: number) => void) => Promise<GameData>;
  /** From the URL; when absent the saved option is used. */
  difficulty: Difficulty | null;
  seed: number;
  startStop: number;
  god: boolean;
  debug: boolean;
  save: SaveStore;
}

const MAX_STEPS_PER_FRAME = 5;
const RESULTS_DELAY = 1.2; // seconds of simulation time between the end of play and the results screen
const EVENT_LOG_SIZE = 500;
const WEAPON_NAMES: Record<string, string> = {
  shotgun: 'SHOTGUN',
  machine_pistol: 'MACHINE PISTOL',
  magnum: 'MAGNUM',
};

/**
 * Wires the simulation to the view: fixed-step loop, the arcade screen flow
 * (title → play → continue → results → initials → high scores → title), input, saves.
 */
export class App {
  readonly renderer: Renderer;
  readonly overlay: Overlay;
  readonly input: InputCapture;
  readonly screens = new Screens();
  readonly hud = new Hud();
  readonly actors: ActorsView;
  readonly tuning: Tuning;
  readonly save: SaveStore;
  readonly audio: AudioDirector;
  game!: Game;
  difficulty: Difficulty;
  /** Recent events, newest last. Read by tests and the debug overlay. */
  readonly eventLog: GameEvent[] = [];
  /** When true the loop renders but does not step the simulation (tests). */
  hold = false;

  private readonly stepSeconds: number;
  private readonly specs: Record<string, WeaponSpec>;
  private accumulator = 0;
  private lastTime = 0;
  private prevCamera: Vec3 = { x: 0, y: 0, z: 0 };
  private endTimer = -1;
  private stageBuilt = false;
  private stageGroup: Object3D | null = null;
  private data: GameData;
  stageId: string;
  private stageName: string;
  /** Set when clearing this stage unlocked the next one, for the results screen. */
  private unlockedName: string | null = null;
  private lastCountdown = -1;
  /** True while the WebGL context is lost; the game stays paused and nothing is drawn in 3D. */
  contextLost = false;
  private saidGo = false;

  constructor(private readonly opts: AppOptions) {
    this.data = opts.data;
    this.stageId = opts.stageId;
    this.stageName = opts.stageName;
    this.tuning = opts.data.tuning;
    this.save = opts.save;
    this.difficulty = opts.difficulty ?? this.save.data.options.difficulty;
    this.specs = weaponSpecs(this.tuning);
    const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
    const stageEl = document.querySelector<HTMLElement>('#stage')!;
    this.renderer = new Renderer(canvas);
    this.overlay = new Overlay(document.querySelector<HTMLCanvasElement>('#overlay')!, this.tuning);
    this.actors = new ActorsView(this.tuning);
    this.renderer.scene.add(this.actors.root);
    this.stepSeconds = 1 / this.tuning.step_hz;
    this.input = new InputCapture(stageEl, this.renderer.camera, { onAction: (a) => this.onAction(a) });
    this.hud.setReducedFlash(this.save.data.options.reducedFlash);
    this.audio = new AudioDirector(this.tuning);
    this.audio.setVolumes(this.save.data.options.musicVolume, this.save.data.options.sfxVolume);
    // Browsers allow sound only after a user gesture: unlock on the first click or key press.
    const unlock = () => this.audio.unlock();
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);

    this.screens.root.addEventListener('click', (e) => this.onScreenClick(e));
    this.screens.root.addEventListener('submit', (e) => {
      e.preventDefault();
      this.onMenu('submit-initials');
    });
    this.screens.root.addEventListener('change', (e) => this.onImportFile(e));

    this.newGame(opts.startStop);
    this.showTitle();

    // The GPU can drop the WebGL context (driver reset, too many tabs). Pause, say so, and carry on
    // when it comes back; three.js re-uploads the scene by itself on restore.
    canvas.addEventListener('webglcontextlost', () => {
      this.contextLost = true;
      this.pauseIfPlaying();
      if (this.screens.current === 'paused')
        this.screens.show('paused', { message: 'GRAPHICS RESET… PLEASE WAIT' });
    });
    canvas.addEventListener('webglcontextrestored', () => {
      this.contextLost = false;
      this.renderer.resize();
      if (this.screens.current === 'paused') this.screens.show('paused', { message: 'GRAPHICS RESTORED' });
    });

    const onHidden = () => this.pauseIfPlaying();
    window.addEventListener('blur', onHidden);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) onHidden();
    });
    requestAnimationFrame((t) => this.frame(t));
  }

  newGame(startStop = this.opts.startStop): void {
    this.game = createGame({
      stage: this.data.stage,
      markers: this.data.markers,
      tuning: this.tuning,
      difficulty: this.difficulty,
      seed: this.opts.seed,
      startStop,
      god: this.opts.god,
    });
    if (!this.stageBuilt) {
      const spawns = this.game.stage.stops.flatMap((stop) => stop.waves.flat().map((sp) => sp.position));
      this.stageGroup = buildStageView(this.game.stage, spawns, this.data.environment);
      this.renderer.scene.add(this.stageGroup);
      this.stageBuilt = true;
    }
    this.prevCamera = this.game.state.camera.position;
    this.renderer.resetLook();
    this.input.drain();
    this.input.held = false;
    this.accumulator = 0;
    this.endTimer = -1;
    this.unlockedName = null;
    this.hud.reset();
    this.overlay.clearEffects();
  }

  start(): void {
    this.screens.show('playing');
    this.hud.show(true);
    this.hud.banner('READY', 1.2);
    this.saidGo = false;
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
    // Automatic weapons keep firing while the button is held; the weapon's rate limit paces them.
    const spec = this.specs[this.game.state.weapon.kind];
    if (spec?.auto && this.input.held && this.input.pointer && this.screens.current === 'playing') {
      this.input.fireAt(this.input.pointer);
    }
    const weaponBefore = this.game.state.weapon.kind;
    const events = this.game.step(this.input.drain());
    if (events.length > 0) {
      this.audio.onEvents(events, weaponBefore);
      this.actors.onEvents(events, this.save.data.options.reducedFlash);
      this.eventLog.push(...events);
      if (this.eventLog.length > EVENT_LOG_SIZE)
        this.eventLog.splice(0, this.eventLog.length - EVENT_LOG_SIZE);
      this.hud.onEvents(events, this.input.pointer);
      this.onEvents(events);
    }
    if (this.screens.current === 'continue') {
      const seconds = Math.ceil(this.game.state.continueTimer / this.tuning.step_hz);
      this.screens.setCountdown(seconds);
      if (seconds !== this.lastCountdown) this.audio.play('tick');
      this.lastCountdown = seconds;
    }
    this.hud.tick(this.stepSeconds);
    // The results delay counts simulation steps (which keep running after the game ends), so it
    // lasts the same in every browser and tests can advance it exactly with stepFrames.
    if (this.endTimer > 0) {
      this.endTimer -= this.stepSeconds;
      if (this.endTimer <= 0) this.showResults();
    }
    return events;
  }

  private onEvents(events: readonly GameEvent[]): void {
    const at = this.input.pointer;
    for (const e of events) {
      switch (e.type) {
        case 'EnemyHit':
        case 'CrateOpened':
          this.overlay.burst(at, 'hit');
          break;
        case 'CivilianHit':
          this.overlay.burst(at, 'civilian');
          break;
        case 'Miss':
        case 'CoverHit':
        case 'ShieldBlock':
          this.overlay.burst(at, 'miss');
          break;
        case 'EnemySpawned':
          if (e.actor === 'boss') this.hud.banner('WARNING: BOSS', 1.6);
          break;
        case 'StopReached':
          if (!this.saidGo) this.hud.banner('GO!', 0.7);
          this.saidGo = true;
          break;
        case 'PlayerHit':
          this.renderer.shake(this.save.data.options.reducedFlash ? 0.015 : 0.06);
          break;
        case 'WeaponPickedUp':
          this.hud.banner(WEAPON_NAMES[e.weapon] ?? '', 1);
          break;
        case 'BossPhase':
          this.hud.banner(e.phase === 2 ? 'FINAL PHASE' : 'BOSS PHASE ' + (e.phase + 1), 1);
          break;
        case 'BossDefeated':
          this.hud.banner(`BOSS DOWN +${e.bonus}`, 1.5);
          break;
        case 'Paused':
          if (this.screens.current === 'playing') this.screens.show('paused');
          break;
        case 'Resumed':
          if (this.screens.current === 'paused') this.screens.show('playing');
          break;
        case 'ContinueOffered':
          this.input.held = false;
          this.screens.show('continue', { seconds: e.seconds, continuesLeft: e.continuesLeft });
          break;
        case 'Continued':
          this.screens.show('playing');
          break;
        case 'GameOver':
          if (this.screens.current === 'continue') this.screens.show('playing');
          this.endTimer = RESULTS_DELAY;
          break;
        case 'StageCleared': {
          const index = this.opts.catalog.findIndex((x) => x.id === this.stageId);
          const next = this.opts.catalog[index + 1];
          const wasLocked = next !== undefined && !this.isUnlocked(next.id);
          this.save.markCleared(this.stageId);
          this.unlockedName = wasLocked ? next.name : null;
          this.endTimer = RESULTS_DELAY;
          break;
        }
      }
    }
  }

  // ---------- Screens and menus ----------

  private showTitle(): void {
    this.hud.show(false);
    const best = this.save.table(this.stageId, this.difficulty)[0]?.score;
    const index = this.opts.catalog.findIndex((x) => x.id === this.stageId);
    const unlocked = this.opts.catalog.filter((x) => this.isUnlocked(x.id)).length;
    this.screens.show('title', {
      difficulty: this.difficulty,
      ...(best ? { best } : {}),
      stageLabel:
        index >= 0 ? `STAGE ${index + 1}: ${this.stageName.toUpperCase()}` : this.stageName.toUpperCase(),
      stagesUnlocked: unlocked,
      stagesTotal: this.opts.catalog.length,
    });
  }

  /** Stage 1 is always open; each later stage opens when the one before it has been cleared. */
  isUnlocked(id: string): boolean {
    const i = this.opts.catalog.findIndex((x) => x.id === id);
    if (i <= 0) return true;
    return this.save.data.cleared.includes(this.opts.catalog[i - 1]!.id);
  }

  /** Swaps to another stage: downloads its data and model only now, behind the loading bar. */
  async selectStage(id: string): Promise<void> {
    if (id === this.stageId && this.stageBuilt) return;
    const info = this.opts.catalog.find((x) => x.id === id);
    this.hud.show(false);
    this.screens.show('loading');
    const data = await this.opts.loadStage(id, (f) => this.screens.setProgress(f));
    if (this.stageGroup) {
      this.renderer.scene.remove(this.stageGroup);
      this.stageGroup.traverse((o) => {
        if (o instanceof Mesh) o.geometry.dispose();
      });
      this.stageGroup = null;
    }
    this.data = data;
    this.stageId = id;
    this.stageName = info?.name ?? (data.stage as { name?: string }).name ?? id;
    this.stageBuilt = false;
    this.newGame(0);
    this.showTitle();
  }

  private cycleStage(): void {
    const open = this.opts.catalog.filter((x) => this.isUnlocked(x.id));
    const i = open.findIndex((x) => x.id === this.stageId);
    const next = open[(i + 1) % open.length];
    if (next && next.id !== this.stageId) void this.selectStage(next.id);
  }

  private showResults(): void {
    const s = this.game.state;
    this.hud.show(false);
    const cleared = s.phase === 'stageClear';
    this.screens.show('results', {
      score: s.score.score,
      cleared,
      ...(s.result ? { rank: s.result.rank } : {}),
      accuracy: s.score.shots === 0 ? 0 : Math.round((s.score.shotsOnTarget / s.score.shots) * 100),
      continuesUsed: s.continuesUsed,
      askInitials: this.save.qualifies(this.stageId, this.difficulty, s.score.score),
      ...(cleared && this.unlockedName ? { unlocked: this.unlockedName } : {}),
    });
  }

  private showScores(difficulty: Difficulty, highlight = -1): void {
    this.screens.show('scores', {
      difficulty,
      stageName: this.stageName.toUpperCase(),
      table: this.save.table(this.stageId, difficulty),
      highlight,
    });
  }

  private showOptions(status = ''): void {
    const o = this.save.data.options;
    this.screens.show('options', {
      difficulty: this.difficulty,
      reducedFlash: o.reducedFlash,
      musicVolume: o.musicVolume,
      sfxVolume: o.sfxVolume,
      status,
    });
  }

  /** Steps a volume through 0, 20, ... 100%, wrapping to 0. */
  private cycleVolume(key: 'musicVolume' | 'sfxVolume'): void {
    const o = this.save.data.options;
    const next = Math.round(o[key] * 5) >= 5 ? 0 : (Math.round(o[key] * 5) + 1) / 5;
    this.save.setOptions({ [key]: next });
    this.audio.setVolumes(this.save.data.options.musicVolume, this.save.data.options.sfxVolume);
    this.showOptions();
  }

  private setDifficulty(d: Difficulty): void {
    this.difficulty = d;
    this.save.setOptions({ difficulty: d });
    this.newGame();
  }

  private onScreenClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    const button = target.closest<HTMLElement>('[data-action]');
    if (button) {
      this.audio.play('menu');
      this.onMenu(button.dataset.action!);
    } else if (!target.closest('form, input, label, table, a') && this.screens.backgroundClicks) {
      const action = DEFAULT_ACTION[this.screens.current];
      if (action) this.onMenu(action);
    }
  }

  /** Every menu action, by name. Public so tests can drive the menus without layout. */
  onMenu(action: string): void {
    const order: Difficulty[] = ['easy', 'normal', 'hard'];
    switch (action) {
      case 'start':
        this.newGame();
        this.start();
        break;
      case 'resume':
        this.input.queuePause();
        break;
      case 'continue':
        this.input.push({ type: 'continue' });
        break;
      case 'giveup':
        this.input.push({ type: 'giveUp' });
        break;
      case 'done':
        this.showScoresOrTitle();
        break;
      case 'submit-initials': {
        const value = this.screens.root.querySelector<HTMLInputElement>('#initials')?.value ?? '';
        const s = this.game.state;
        const place = this.save.addScore(this.stageId, this.difficulty, {
          initials: value,
          score: s.score.score,
          rank: s.result?.rank ?? 'C',
          date: new Date().toISOString().slice(0, 10),
        });
        this.showScores(this.difficulty, place);
        break;
      }
      case 'title':
        this.newGame();
        this.showTitle();
        break;
      case 'difficulty':
        this.setDifficulty(order[(order.indexOf(this.difficulty) + 1) % order.length]!);
        this.showTitle();
        break;
      case 'scores':
        this.showScores(this.difficulty);
        break;
      case 'scores-easy':
      case 'scores-normal':
      case 'scores-hard':
        this.showScores(action.slice(7) as Difficulty);
        break;
      case 'options':
        this.showOptions();
        break;
      case 'credits':
        this.screens.show('credits');
        break;
      case 'stage':
        this.cycleStage();
        break;
      case 'set-easy':
      case 'set-normal':
      case 'set-hard':
        this.setDifficulty(action.slice(4) as Difficulty);
        this.showOptions();
        break;
      case 'flash':
        this.save.setOptions({ reducedFlash: !this.save.data.options.reducedFlash });
        this.hud.setReducedFlash(this.save.data.options.reducedFlash);
        this.showOptions();
        break;
      case 'music':
        this.cycleVolume('musicVolume');
        break;
      case 'sfx':
        this.cycleVolume('sfxVolume');
        this.audio.play('hit');
        break;
      case 'export':
        this.exportSave();
        this.showOptions('SAVE EXPORTED');
        break;
      case 'import':
        this.screens.root.querySelector<HTMLInputElement>('#import-file')?.click();
        break;
      case 'fullscreen':
        this.onAction('fullscreen');
        break;
    }
  }

  private showScoresOrTitle(): void {
    if (this.save.table(this.stageId, this.difficulty).length > 0) this.showScores(this.difficulty);
    else {
      this.newGame();
      this.showTitle();
    }
  }

  private exportSave(): void {
    const blob = new Blob([this.save.exportText()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'real-cop-2-save.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  private onImportFile(e: Event): void {
    const input = e.target as HTMLInputElement;
    if (input.id !== 'import-file' || !input.files?.[0]) return;
    void input.files[0].text().then((text) => {
      const ok = this.save.importText(text);
      if (ok) {
        this.difficulty = this.save.data.options.difficulty;
        this.hud.setReducedFlash(this.save.data.options.reducedFlash);
        this.audio.setVolumes(this.save.data.options.musicVolume, this.save.data.options.sfxVolume);
        this.newGame();
      }
      this.showOptions(ok ? 'SAVE IMPORTED' : 'THAT FILE IS NOT A REAL COP 2 SAVE');
    });
  }

  /** Pointer-down and key handling outside gameplay. Returns true when the event is not a shot. */
  onAction(action: 'click' | 'pause' | 'fullscreen'): boolean {
    if (action === 'fullscreen') {
      if (document.fullscreenElement) void document.exitFullscreen();
      else document.documentElement.requestFullscreen?.().catch(() => undefined);
      return true;
    }
    const screen = this.screens.current;
    if (action === 'pause') return screen !== 'playing' && screen !== 'paused';
    // Menus handle their own clicks (onScreenClick); only the playfield turns clicks into shots.
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

    const live = this.screens.current === 'playing' || this.screens.current === 'continue';
    if (live && !this.hold) {
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
    const screen = this.screens.current;
    const playing = screen === 'playing';
    const pointer = this.input.pointer;
    this.overlay.draw({
      dt,
      camera: this.renderer.camera,
      rings: playing || screen === 'paused' || screen === 'continue' ? s.rings : [],
      actors: s.actors,
      pointer,
      showCrosshair: playing,
      borderZone: pointer !== null && this.input.inBorderZone(pointer),
      debug: this.opts.debug,
      reducedFlash: this.save.data.options.reducedFlash,
    });
    this.hud.update(s);

    // Music follows the screen: title theme on menus, the stage or boss theme in play (quieter while
    // paused or offered a continue), silence under the results jingle.
    if (playing || screen === 'paused' || screen === 'continue') {
      this.audio.playMusic(
        this.audio.themeFor(s),
        Math.max(
          0,
          this.opts.catalog.findIndex((x) => x.id === this.stageId),
        ),
      );
      this.audio.duck(!playing);
      if (playing) this.audio.update(s);
    } else if (screen === 'results') {
      this.audio.playMusic(null);
    } else {
      this.audio.playMusic('title');
      this.audio.duck(false);
    }
  }
}
