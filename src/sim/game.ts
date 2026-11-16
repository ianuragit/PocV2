import { createRng } from './rng.ts';
import { advanceRings, promoteWaiting, ringsOf } from './rings.ts';
import { accuracy, bonusLivesCrossed, breakCombo, createScore, rankFor, registerHit } from './score.ts';
import { hitZones, pelletDirections, traceRay, type ShotHit } from './shots.ts';
import { resolveStage, type ResolvedSpawn, type ResolvedStage } from './stage.ts';
import { add, lerp, normalize, scale, sub, vec } from './vec.ts';
import {
  createWeapon,
  dropSpecial,
  pickUp,
  startReload,
  tickWeapon,
  tryFire,
  weaponSpecs,
  type Armoury,
} from './weapons.ts';
import type { Actor, Difficulty, GameEvent, GamePhase, GameState, Input, Markers, Tuning } from './types.ts';

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

/** How high a thrown object arcs above the straight line to the player, in metres. */
const THROW_ARC = 1.2;
/** Thrown objects aim this far in front of the camera, so they are visible as they land. */
const THROW_STOP_SHORT = 1.2;

const LIVE = new Set(['entering', 'waiting', 'aiming', 'moving']);

export function createGame(opts: GameOptions): Game {
  const { tuning, difficulty } = opts;
  const stage = resolveStage(opts.stage, opts.markers, tuning);
  const hz = tuning.step_hz;
  const frames = (seconds: number) => Math.round(seconds * hz);
  const diff = tuning.difficulty[difficulty];
  const rng = createRng(opts.seed);
  const specs = weaponSpecs(tuning);
  const invulnerableFrames = frames(tuning.player.invulnerable_time);
  const ringPauseFrames = frames(tuning.player.ring_pause_on_hit);
  const aimFramesFor = (seconds: number) => frames(seconds * diff.aim_time_scale);

  const startStop = opts.startStop ?? 0;
  if (!Number.isInteger(startStop) || startStop < 0 || startStop >= stage.stops.length) {
    throw new Error(`startStop must be 0..${stage.stops.length - 1}`);
  }
  const startOffset = startStop === 0 ? 0 : stage.stops[startStop - 1]!.pathOffset;
  const armoury: Armoury = { current: createWeapon(specs.revolver), stashedRevolverAmmo: null };
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
    weapon: armoury.current,
    score: createScore(),
    lives: diff.lives,
    invulnerable: 0,
    ringPause: 0,
    continuesLeft: tuning.player.continues,
    continuesUsed: 0,
    continueTimer: 0,
    result: null,
  };
  const actors: Actor[] = state.actors as Actor[];
  const director: Director = { waveFrame: 0, pending: [], waveGap: 0, waveCleared: false };
  let nextId = 1;
  let resumePhase: GamePhase = 'combat';

  // ---------- Lives, continues ----------

  function loseLife(events: GameEvent[], cause: 'shot' | 'civilian'): void {
    if (opts.god) return;
    if (armoury.current.kind !== 'revolver') {
      const weapon = armoury.current.kind;
      dropSpecial(armoury, specs);
      events.push({ type: 'WeaponLost', weapon, reason: 'hit' });
    }
    state.lives = Math.max(0, state.lives - 1);
    events.push({ type: 'PlayerHit', lives: state.lives, cause });
    if (state.lives === 0) {
      if (state.continuesLeft > 0) {
        resumePhase = state.phase;
        state.phase = 'continue';
        state.continueTimer = frames(tuning.player.continue_time);
        events.push({
          type: 'ContinueOffered',
          continuesLeft: state.continuesLeft,
          seconds: tuning.player.continue_time,
        });
      } else {
        endGame(events);
      }
      return;
    }
    if (cause === 'shot') {
      state.invulnerable = invulnerableFrames;
      state.ringPause = ringPauseFrames;
    }
  }

  function endGame(events: GameEvent[]): void {
    state.phase = 'gameOver';
    events.push({ type: 'GameOver', score: state.score.score });
  }

  /** Accepting a continue refills lives and starts the score again, so continues never buy points. */
  function acceptContinue(events: GameEvent[]): void {
    state.continuesLeft -= 1;
    state.continuesUsed += 1;
    state.lives = diff.lives;
    Object.assign(state.score, createScore());
    state.phase = resumePhase;
    state.invulnerable = invulnerableFrames;
    state.ringPause = ringPauseFrames;
    for (const a of actors) if (a.phase === 'aiming') a.ringElapsed = 0;
    events.push({ type: 'Continued', continuesLeft: state.continuesLeft });
  }

  function addPoints(events: GameEvent[], before: number): void {
    const bonus = bonusLivesCrossed(before, state.score.score, tuning.player.bonus_lives_at);
    for (let i = 0; i < bonus; i++) {
      state.lives += 1;
      events.push({ type: 'BonusLife', lives: state.lives });
    }
  }

  // ---------- Shooting ----------

  function fire(events: GameEvent[], input: Extract<Input, { type: 'fire' }>): void {
    const spec = specs[armoury.current.kind];
    const result = tryFire(armoury.current, spec);
    if (result === 'busy') return;
    if (result === 'empty') {
      events.push({ type: 'DryFire' });
      return;
    }
    events.push({ type: 'ShotFired', ammo: armoury.current.ammo });
    state.score.shots += 1;

    // Every pellet traces its own ray; each actor is hit at most once per shot (first pellet wins).
    const hitActors: Extract<ShotHit, { kind: 'actor' }>[] = [];
    let blocker: ShotHit | null = null;
    for (const direction of pelletDirections(input.direction, spec.pellets, spec.spreadRadians)) {
      for (const hit of traceRay(
        { origin: input.origin, direction },
        actors,
        stage.covers,
        tuning,
        spec.pierce,
      )) {
        if (hit.kind === 'actor') {
          if (!hitActors.some((h) => h.actor === hit.actor)) hitActors.push(hit);
        } else if (!blocker || hit.kind === 'shield') {
          blocker = hit;
        }
      }
    }

    if (hitActors.length === 0) {
      breakCombo(state.score);
      if (blocker?.kind === 'shield') events.push({ type: 'ShieldBlock', id: blocker.actor.id });
      else if (blocker?.kind === 'cover') events.push({ type: 'CoverHit', name: blocker.name });
      else events.push({ type: 'Miss' });
    } else {
      state.score.shotsOnTarget += 1;
      for (const hit of hitActors) {
        if (state.phase === 'continue' || isOver()) break;
        resolveHit(events, hit);
      }
    }

    if (armoury.current.kind !== 'revolver' && armoury.current.ammo === 0) {
      const weapon = armoury.current.kind;
      dropSpecial(armoury, specs);
      events.push({ type: 'WeaponLost', weapon, reason: 'empty' });
    }
  }

  function resolveHit(events: GameEvent[], hit: Extract<ShotHit, { kind: 'actor' }>): void {
    const actor = hit.actor;
    const before = state.score.score;
    switch (actor.role) {
      case 'crate': {
        actor.phase = 'opened';
        state.score.hits += 1;
        events.push({ type: 'CrateOpened', id: actor.id, weapon: actor.weapon! });
        pickUp(armoury, actor.weapon!, specs);
        events.push({ type: 'WeaponPickedUp', weapon: actor.weapon! });
        return;
      }
      case 'civilian': {
        actor.phase = 'fled';
        breakCombo(state.score);
        events.push({ type: 'CivilianHit', id: actor.id });
        loseLife(events, 'civilian');
        return;
      }
      case 'projectile': {
        actor.phase = 'dead';
        const points = registerHit(state.score, 'thrown', tuning.scoring);
        events.push({
          type: 'EnemyHit',
          id: actor.id,
          zone: 'thrown',
          points,
          killed: true,
          disarmed: false,
        });
        addPoints(events, before);
        return;
      }
      case 'boss': {
        // The boss cannot be disarmed: a gun-hand hit counts as a body hit.
        const zone = hit.zone === 'gun_hand' ? 'body' : hit.zone;
        actor.hitsLeft -= 1;
        const phaseDown = actor.hitsLeft <= 0;
        const boss = actor.boss!;
        const last = boss.phase + 1 >= boss.positions.length;
        const points = registerHit(state.score, zone, tuning.scoring);
        events.push({
          type: 'EnemyHit',
          id: actor.id,
          zone,
          points,
          killed: phaseDown && last,
          disarmed: false,
        });
        if (phaseDown && last) {
          actor.phase = 'dead';
          state.score.score += tuning.boss.bonus;
          events.push({ type: 'BossDefeated', id: actor.id, bonus: tuning.boss.bonus });
        } else if (phaseDown) {
          boss.phase += 1;
          actor.phase = 'moving';
          actor.timer = frames(tuning.boss.move_time);
          actor.ringElapsed = 0;
          events.push({ type: 'BossPhase', id: actor.id, phase: boss.phase });
        }
        addPoints(events, before);
        return;
      }
      case 'enemy': {
        const disarmed = hit.zone === 'gun_hand';
        actor.hitsLeft -= 1;
        const killed = !disarmed && actor.hitsLeft <= 0;
        if (disarmed) actor.phase = 'disarmed';
        else if (killed) actor.phase = 'dead';
        const points = registerHit(state.score, hit.zone, tuning.scoring);
        events.push({ type: 'EnemyHit', id: actor.id, zone: hit.zone, points, killed, disarmed });
        addPoints(events, before);
        return;
      }
    }
  }

  // ---------- Waves and actors ----------

  function startWave(events: GameEvent[], wave: number): void {
    // Actors resolved in earlier waves are gone; the view has already had their events.
    for (let i = actors.length - 1; i >= 0; i--) {
      if (!LIVE.has(actors[i]!.phase) && actors[i]!.phase !== 'flying' && actors[i]!.phase !== 'standing') {
        actors.splice(i, 1);
      }
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
      const actor: Actor = {
        id: nextId++,
        type: s.type,
        role: s.role,
        civilian: s.civilian,
        position: s.position,
        yaw: s.yaw,
        phase: 'entering',
        timer: s.entryFrames,
        hitsLeft: 1,
        aimFrames: 0,
        ringFrames: 0,
        ringElapsed: 0,
        queuedAt: 0,
        shots: 0,
      };
      if (s.role === 'enemy') {
        const def = tuning.enemies[s.type]!;
        actor.hitsLeft = def.hits;
        actor.aimFrames = aimFramesFor(s.aimTime ?? def.aim_time);
      } else if (s.role === 'boss') {
        const p0 = tuning.boss.phases[0]!;
        actor.hitsLeft = p0.hits;
        actor.aimFrames = aimFramesFor(p0.aim_time);
        actor.boss = {
          phase: 0,
          positions: s.phases!.map((p) => p.position),
          yaws: s.phases!.map((p) => p.yaw),
        };
      } else if (s.role === 'crate') {
        actor.weapon = s.weapon!;
      }
      actor.ringFrames = actor.aimFrames;
      actors.push(actor);
      events.push({ type: 'EnemySpawned', id: actor.id, actor: s.type });
      if (actor.timer === 0) finishEntry(actor);
    }
  }

  function finishEntry(actor: Actor): void {
    if (actor.role === 'civilian') {
      actor.phase = 'standing';
      actor.timer = frames(tuning.civilian.stay_time);
    } else if (actor.role === 'crate') {
      actor.phase = 'standing';
      actor.timer = -1; // stays until opened or the wave ends
    } else {
      actor.phase = 'waiting';
      actor.queuedAt = state.frame;
    }
  }

  function throwFrom(events: GameEvent[], thrower: Actor): void {
    const from = hitZones(thrower, tuning.body).hand.center;
    const cam = state.camera.position;
    const to = add(cam, scale(normalize(sub(from, cam)), THROW_STOP_SHORT));
    const flightFrames = frames(tuning.enemies[thrower.type]!.flight_time ?? 2.5);
    const p: Actor = {
      id: nextId++,
      type: 'projectile',
      role: 'projectile',
      civilian: false,
      position: from,
      yaw: thrower.yaw,
      phase: 'flying',
      timer: flightFrames,
      hitsLeft: 1,
      aimFrames: 0,
      ringFrames: 0,
      ringElapsed: 0,
      queuedAt: 0,
      shots: 0,
      flight: { from, to, frames: flightFrames },
    };
    actors.push(p);
    events.push({ type: 'ProjectileThrown', id: p.id, from: thrower.id });
  }

  function updateActors(events: GameEvent[], protectedThisStep: boolean): void {
    for (const actor of actors) {
      if (actor.phase === 'entering') {
        actor.timer -= 1;
        if (actor.timer <= 0) finishEntry(actor);
      } else if (actor.phase === 'standing' && actor.role === 'civilian') {
        actor.timer -= 1;
        if (actor.timer <= 0) {
          actor.phase = 'fled';
          events.push({ type: 'CivilianLeft', id: actor.id });
        }
      } else if (actor.phase === 'moving') {
        actor.timer -= 1;
        if (actor.timer <= 0) {
          const boss = actor.boss!;
          const phase = tuning.boss.phases[boss.phase]!;
          actor.position = boss.positions[boss.phase]!;
          actor.yaw = boss.yaws[boss.phase]!;
          actor.hitsLeft = phase.hits;
          actor.aimFrames = aimFramesFor(phase.aim_time);
          actor.phase = 'waiting';
          actor.queuedAt = state.frame;
        }
      } else if (actor.phase === 'flying') {
        const f = actor.flight!;
        actor.timer -= 1;
        const t = 1 - actor.timer / f.frames;
        actor.position = add(lerp(f.from, f.to, t), vec(0, THROW_ARC * 4 * t * (1 - t), 0));
        if (actor.timer <= 0) {
          const hit = !opts.god && !protectedThisStep && state.invulnerable === 0;
          actor.phase = 'fled';
          events.push({ type: 'ProjectileLanded', id: actor.id, hit });
          if (hit) loseLife(events, 'shot');
          if (state.phase === 'continue' || isOver()) return;
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
      actor.shots += 1;
      actor.phase = 'waiting';
      actor.queuedAt = state.frame;
      if (actor.role === 'enemy' && tuning.enemies[actor.type]!.attack === 'throw') {
        events.push({ type: 'RingClosed', id: actor.id, hit: false });
        throwFrom(events, actor);
        continue;
      }
      const hit = !opts.god && !protectedThisStep && state.invulnerable === 0;
      events.push({ type: 'RingClosed', id: actor.id, hit });
      if (hit) loseLife(events, 'shot');
      if (state.phase === 'continue' || isOver()) return;
    }
  }

  function checkWaveCleared(events: GameEvent[]): void {
    if (director.waveCleared || director.pending.length > 0) return;
    const hostile = actors.some(
      (a) => ((a.role === 'enemy' || a.role === 'boss') && LIVE.has(a.phase)) || a.phase === 'flying',
    );
    if (hostile) return;
    director.waveCleared = true;
    events.push({ type: 'WaveCleared', stop: state.stop, wave: state.wave });
    for (const a of actors) {
      if (
        (a.role === 'civilian' || a.role === 'crate') &&
        (a.phase === 'entering' || a.phase === 'standing')
      ) {
        a.phase = 'fled';
        if (a.role === 'civilian') events.push({ type: 'CivilianLeft', id: a.id });
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
      const rank = rankFor(state.score.score, stage.rankThresholds);
      state.result = {
        score: state.score.score,
        rank,
        accuracy: accuracy(state.score),
        continuesUsed: state.continuesUsed,
      };
      events.push({ type: 'StageCleared', score: state.score.score, rank });
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
  const halted = (): boolean => state.phase === 'continue' || state.phase === 'gameOver';

  function stepContinue(events: GameEvent[], inputs: readonly Input[]): void {
    for (const input of inputs) {
      if (input.type === 'continue') return acceptContinue(events);
      if (input.type === 'giveUp') return endGame(events);
    }
    state.continueTimer -= 1;
    if (state.continueTimer <= 0) endGame(events);
  }

  function step(inputs: readonly Input[] = []): GameEvent[] {
    const events: GameEvent[] = [];
    for (const input of inputs) {
      if (input.type === 'pause') {
        state.paused = !state.paused;
        events.push({ type: state.paused ? 'Paused' : 'Resumed' });
      }
    }
    if (state.paused || state.phase === 'gameOver' || state.phase === 'stageClear') return events;
    if (state.phase === 'continue') {
      stepContinue(events, inputs);
      state.rings = ringsOf(actors, tuning.rings);
      return events;
    }

    state.frame += 1;
    // Invulnerability set on step k covers steps k+1 .. k+N.
    const protectedThisStep = state.invulnerable > 0;
    if (state.invulnerable > 0) state.invulnerable -= 1;

    if (tickWeapon(armoury.current)) events.push({ type: 'Reloaded' });
    for (const input of inputs) {
      if (input.type === 'reload' && startReload(armoury.current, specs[armoury.current.kind])) {
        events.push({ type: 'ReloadStarted' });
      } else if (input.type === 'fire') fire(events, input);
      if (halted()) break;
    }

    if (!halted()) updateDirector(events);
    if (!halted()) updateActors(events, protectedThisStep);
    if (!halted()) updateRings(events, protectedThisStep);
    if (!halted() && state.phase === 'combat') checkWaveCleared(events);
    state.rings = ringsOf(actors, tuning.rings);
    return events;
  }

  return { stage, state, step };
}
