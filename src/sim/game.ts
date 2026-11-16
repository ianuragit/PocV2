import { createRng } from './rng.ts';
import { advanceRings, promoteWaiting, ringsOf } from './rings.ts';
import { bonusLivesCrossed, breakCombo, createScore, registerHit } from './score.ts';
import { resolveShot } from './shots.ts';
import { resolveStage, type ResolvedSpawn, type ResolvedStage } from './stage.ts';
import { normalize } from './vec.ts';
import { createWeapon, startReload, tickWeapon, tryFire, weaponSpec } from './weapons.ts';
import type { Actor, Difficulty, GameEvent, GameState, Input, Markers, Tuning } from './types.ts';

export interface GameOptions {
  /** Parsed stage JSON. Validated against the markers and tuning; invalid data throws. */
  stage: unknown;
  markers: Markers;
  tuning: Tuning;
  difficulty: Difficulty;
  seed: number;
  /** Debug: begin by travelling to this stop index instead of stop 0. */
  startStop?: number;
  /** Debug: the player never loses a life. */
  god?: boolean;
}

export interface Game {
  readonly stage: ResolvedStage;
  /** Live state. Read it; never write it from outside src/sim. */
  readonly state: GameState;
  /** Advances one fixed step (1 / tuning.step_hz seconds) and returns what happened. */
  step(inputs?: readonly Input[]): GameEvent[];
}

interface Director {
  /** Steps since the current wave started. */
  waveFrame: number;
  /** Spawns of the current wave not yet placed. */
  pending: ResolvedSpawn[];
  /** Steps left before the next wave in this stop starts. */
  waveGap: number;
  waveCleared: boolean;
}

export function createGame(opts: GameOptions): Game {
  const { tuning, difficulty } = opts;
  const stage = resolveStage(opts.stage, opts.markers, tuning);
  const hz = tuning.step_hz;
  const frames = (seconds: number) => Math.round(seconds * hz);
  const diff = tuning.difficulty[difficulty];
  const rng = createRng(opts.seed);
  const spec = weaponSpec(tuning.revolver, hz);
  const invulnerableFrames = frames(tuning.player.invulnerable_time);
  const ringPauseFrames = frames(tuning.player.ring_pause_on_hit);

  const startStop = opts.startStop ?? 0;
  if (!Number.isInteger(startStop) || startStop < 0 || startStop >= stage.stops.length) {
    throw new Error(`startStop must be 0..${stage.stops.length - 1}`);
  }
  const startOffset = startStop === 0 ? 0 : stage.stops[startStop - 1]!.pathOffset;
  const state: GameState = {
    frame: 0,
    phase: 'travel',
    paused: false,
    difficulty,
    camera: {
      position: stage.path.pointAt(startOffset),
      lookAt: stage.stops[startStop]!.lookAt,
      pathOffset: startOffset,
    },
    stop: startStop,
    wave: 0,
    actors: [],
    rings: [],
    weapon: createWeapon(spec),
    score: createScore(),
    lives: diff.lives,
    invulnerable: 0,
    ringPause: 0,
  };
  const actors: Actor[] = state.actors as Actor[];
  const director: Director = { waveFrame: 0, pending: [], waveGap: 0, waveCleared: false };
  let nextId = 1;

  function loseLife(events: GameEvent[], cause: 'shot' | 'civilian'): void {
    if (opts.god) return;
    state.lives = Math.max(0, state.lives - 1);
    events.push({ type: 'PlayerHit', lives: state.lives, cause });
    if (state.lives === 0) {
      state.phase = 'gameOver';
      events.push({ type: 'GameOver', score: state.score.score });
      return;
    }
    if (cause === 'shot') {
      state.invulnerable = invulnerableFrames;
      state.ringPause = ringPauseFrames;
    }
  }

  function fire(events: GameEvent[], input: Extract<Input, { type: 'fire' }>): void {
    const result = tryFire(state.weapon, spec);
    if (result === 'busy') return;
    if (result === 'empty') {
      events.push({ type: 'DryFire' });
      return;
    }
    events.push({ type: 'ShotFired', ammo: state.weapon.ammo });
    state.score.shots += 1;
    const ray = { origin: input.origin, direction: normalize(input.direction) };
    const target = resolveShot(ray, actors, stage.covers, tuning.body);
    if (target.kind === 'none') {
      breakCombo(state.score);
      events.push({ type: 'Miss' });
    } else if (target.kind === 'cover') {
      breakCombo(state.score);
      events.push({ type: 'CoverHit', name: target.name });
    } else if (target.actor.civilian) {
      target.actor.phase = 'fled';
      breakCombo(state.score);
      events.push({ type: 'CivilianHit', id: target.actor.id });
      loseLife(events, 'civilian');
    } else {
      const actor = target.actor;
      const disarmed = target.zone === 'gun_hand';
      actor.hitsLeft -= 1;
      const killed = !disarmed && actor.hitsLeft <= 0;
      if (disarmed) actor.phase = 'disarmed';
      else if (killed) actor.phase = 'dead';
      const before = state.score.score;
      const points = registerHit(state.score, target.zone, tuning.scoring);
      events.push({ type: 'EnemyHit', id: actor.id, zone: target.zone, points, killed, disarmed });
      const bonus = bonusLivesCrossed(before, state.score.score, tuning.player.bonus_lives_at);
      for (let i = 0; i < bonus; i++) {
        state.lives += 1;
        events.push({ type: 'BonusLife', lives: state.lives });
      }
    }
  }

  function startWave(events: GameEvent[], wave: number): void {
    // Actors resolved in earlier waves are gone; the view has already had their events.
    for (let i = actors.length - 1; i >= 0; i--) {
      const p = actors[i]!.phase;
      if (p === 'dead' || p === 'disarmed' || p === 'fled') actors.splice(i, 1);
    }
    state.wave = wave;
    director.waveFrame = 0;
    director.waveCleared = false;
    director.pending = [...stage.stops[state.stop]!.waves[wave]!];
    events.push({ type: 'WaveStarted', stop: state.stop, wave });
    spawnDue(events);
  }

  function spawnDue(events: GameEvent[]): void {
    const due = director.pending.filter((s) => s.delayFrames <= director.waveFrame);
    director.pending = director.pending.filter((s) => s.delayFrames > director.waveFrame);
    for (const s of due) {
      const enemy = s.civilian ? undefined : tuning.enemies[s.type]!;
      const aimFrames = enemy ? frames((s.aimTime ?? enemy.aim_time) * diff.aim_time_scale) : 0;
      const actor: Actor = {
        id: nextId++,
        type: s.type,
        civilian: s.civilian,
        position: s.position,
        yaw: s.yaw,
        phase: 'entering',
        timer: s.entryFrames,
        hitsLeft: enemy ? enemy.hits : 1,
        aimFrames,
        ringFrames: aimFrames,
        ringElapsed: 0,
        queuedAt: 0,
        shots: 0,
      };
      actors.push(actor);
      events.push({ type: 'EnemySpawned', id: actor.id, actor: s.type });
      if (actor.timer === 0) finishEntry(actor);
    }
  }

  function finishEntry(actor: Actor): void {
    if (actor.civilian) {
      actor.phase = 'standing';
      actor.timer = frames(tuning.civilian.stay_time);
    } else {
      actor.phase = 'waiting';
      actor.queuedAt = state.frame;
    }
  }

  function updateActors(events: GameEvent[]): void {
    for (const actor of actors) {
      if (actor.phase === 'entering') {
        actor.timer -= 1;
        if (actor.timer <= 0) finishEntry(actor);
      } else if (actor.phase === 'standing') {
        actor.timer -= 1;
        if (actor.timer <= 0) {
          actor.phase = 'fled';
          events.push({ type: 'CivilianLeft', id: actor.id });
        }
      }
    }
  }

  function updateRings(events: GameEvent[], protectedThisStep: boolean): void {
    events.push(...promoteWaiting(actors, diff.max_rings, rng, tuning.rings.reaim_jitter));
    if (state.ringPause > 0) {
      state.ringPause -= 1;
      return;
    }
    for (const actor of advanceRings(actors)) {
      const hit = !isOver() && !opts.god && !protectedThisStep && state.invulnerable === 0;
      events.push({ type: 'RingClosed', id: actor.id, hit });
      actor.shots += 1;
      actor.phase = 'waiting';
      actor.queuedAt = state.frame;
      if (hit) loseLife(events, 'shot');
    }
  }

  function checkWaveCleared(events: GameEvent[]): void {
    if (director.waveCleared || director.pending.length > 0) return;
    const hostile = actors.some(
      (a) => !a.civilian && (a.phase === 'entering' || a.phase === 'waiting' || a.phase === 'aiming'),
    );
    if (hostile) return;
    director.waveCleared = true;
    events.push({ type: 'WaveCleared', stop: state.stop, wave: state.wave });
    for (const a of actors) {
      if (a.civilian && (a.phase === 'entering' || a.phase === 'standing')) {
        a.phase = 'fled';
        events.push({ type: 'CivilianLeft', id: a.id });
      }
    }
    const stop = stage.stops[state.stop]!;
    if (state.wave + 1 < stop.waves.length) {
      director.waveGap = frames(tuning.director.wave_gap);
      if (director.waveGap === 0) startWave(events, state.wave + 1);
    } else if (state.stop + 1 < stage.stops.length) {
      state.stop += 1;
      state.wave = 0;
      state.phase = 'travel';
      state.camera.lookAt = stage.stops[state.stop]!.lookAt;
    } else {
      state.phase = 'stageClear';
      events.push({ type: 'StageCleared', score: state.score.score });
    }
  }

  function updateDirector(events: GameEvent[]): void {
    if (state.phase === 'travel') {
      const stop = stage.stops[state.stop]!;
      let offset = state.camera.pathOffset + stop.stepDistance;
      // Snap within a tiny epsilon so float drift never adds an extra travel step.
      if (offset >= stop.pathOffset - 1e-9) offset = stop.pathOffset;
      state.camera.pathOffset = offset;
      state.camera.position = stage.path.pointAt(offset);
      if (offset === stop.pathOffset) {
        state.phase = 'combat';
        events.push({ type: 'StopReached', stop: state.stop });
        startWave(events, 0);
      }
    } else if (state.phase === 'combat') {
      if (director.waveCleared) {
        if (director.waveGap > 0 && --director.waveGap === 0) startWave(events, state.wave + 1);
      } else {
        director.waveFrame += 1;
        spawnDue(events);
      }
    }
  }

  const isOver = (): boolean => state.phase === 'gameOver';

  function step(inputs: readonly Input[] = []): GameEvent[] {
    const events: GameEvent[] = [];
    for (const input of inputs) {
      if (input.type === 'pause') {
        state.paused = !state.paused;
        events.push({ type: state.paused ? 'Paused' : 'Resumed' });
      }
    }
    if (state.paused || state.phase === 'gameOver' || state.phase === 'stageClear') return events;

    state.frame += 1;
    // Invulnerability set on step k covers steps k+1 .. k+N.
    const protectedThisStep = state.invulnerable > 0;
    if (state.invulnerable > 0) state.invulnerable -= 1;

    if (tickWeapon(state.weapon)) events.push({ type: 'Reloaded' });
    for (const input of inputs) {
      if (input.type === 'reload' && startReload(state.weapon, spec)) events.push({ type: 'ReloadStarted' });
      else if (input.type === 'fire') fire(events, input);
      if (isOver()) break;
    }

    if (!isOver()) {
      updateDirector(events);
      updateActors(events);
      updateRings(events, protectedThisStep);
      if (state.phase === 'combat') checkWaveCleared(events);
    }
    state.rings = ringsOf(actors, tuning.rings);
    return events;
  }

  return { stage, state, step };
}
