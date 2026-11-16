import { describe, expect, it } from 'vitest';
import { createGame } from '../../src/sim/game.ts';
import { hitZones } from '../../src/sim/shots.ts';
import { vec, type Vec3 } from '../../src/sim/vec.ts';
import type { Difficulty, GameEvent, Markers, SpawnDef, Tuning } from '../../src/sim/types.ts';
import { aimAt, bodyCenter, newGame, runUntil, tuning } from '../helpers.ts';

const P = (x: number, y: number, z: number, yaw = 0) => ({
  position: [x, y, z] as [number, number, number],
  rotation: [0, yaw, 0] as [number, number, number],
});
const markers: Markers = {
  Path_000: P(0, 1.6, 0),
  Path_001: P(0, 1.6, 20),
  Look_A: P(0, 1.2, 10),
  Spawn_Mid: P(0, 0, 10, Math.PI),
  Spawn_Right: P(-2, 0, 10, Math.PI),
  Spawn_Left: P(2, 0, 10, Math.PI),
  Cover_Box: { ...P(0, 1, 30), scale: [1, 1, 1] },
};
const spawn = (type: string, marker = 'Spawn_Mid', extra: Partial<SpawnDef> = {}): SpawnDef => ({
  type,
  marker,
  entry: 'appear',
  delay: 0,
  ...extra,
});
const stageWith = (waves: SpawnDef[][]) => ({
  id: 'test',
  name: 'Test',
  environment: 'x.glb',
  music: 'x.ogg',
  rank_thresholds: { S: 3, A: 2, B: 1 },
  scenes: [
    {
      id: 'a',
      stops: [
        { path_offset: 0, travel_speed: 4, look_at: 'Look_A', waves: waves.map((spawns) => ({ spawns })) },
      ],
    },
  ],
});

function setup(waves: SpawnDef[][], opts: { tuning?: Tuning; difficulty?: Difficulty } = {}) {
  const t = opts.tuning ?? tuning();
  const game = createGame({
    stage: stageWith(waves),
    markers,
    tuning: t,
    difficulty: opts.difficulty ?? 'normal',
    seed: 1,
  });
  const log: { frame: number; event: GameEvent }[] = [];
  const step = (inputs: Parameters<typeof game.step>[0] = []) => {
    const events = game.step(inputs);
    for (const event of events) log.push({ frame: game.state.frame, event });
    return events;
  };
  const stepN = (n: number) => {
    for (let i = 0; i < n; i++) step();
  };
  const actor = (id: number) => game.state.actors.find((a) => a.id === id)!;
  const shoot = (target: Vec3) => step([aimAt(game, target)]);
  const shootBody = (id: number) => shoot(bodyCenter(actor(id), t));
  const at = (type: GameEvent['type']) => log.filter((e) => e.event.type === type);
  return { game, t, step, stepN, actor, shoot, shootBody, at, log };
}

describe('game flow', () => {
  it('arrives at a stop, spawns the wave and closes a 2.0 s ring after exactly 120 steps', () => {
    const g = setup([[spawn('grunt')]]);
    expect(g.step().map((e) => e.type)).toEqual([
      'StopReached',
      'WaveStarted',
      'EnemySpawned',
      'RingStarted',
    ]);
    expect(g.game.state.phase).toBe('combat');
    g.stepN(118);
    expect(g.game.state.rings[0]!.progress).toBeCloseTo(119 / 120);
    expect(g.at('PlayerHit')).toEqual([]);
    g.step();
    expect(g.at('RingClosed')).toEqual([{ frame: 120, event: { type: 'RingClosed', id: 1, hit: true } }]);
    expect(g.at('PlayerHit')[0]!.event).toEqual({ type: 'PlayerHit', lives: 4, cause: 'shot' });
  });

  it('gives 1.0 s of invulnerability and pauses other rings 0.5 s after a hit', () => {
    const g = setup([
      [
        spawn('grunt'),
        spawn('grunt', 'Spawn_Left', { aim_time: 2.1 }),
        spawn('grunt', 'Spawn_Right', { aim_time: 3.0 }),
      ],
    ]);
    g.stepN(300);
    const closed = (id: number) =>
      g.at('RingClosed').find((e) => e.event.type === 'RingClosed' && e.event.id === id)!;
    expect(closed(1)).toEqual({ frame: 120, event: { type: 'RingClosed', id: 1, hit: true } });
    // 126 steps + 30 paused = 156, inside invulnerability (121..180): the shot misses.
    expect(closed(2)).toEqual({ frame: 156, event: { type: 'RingClosed', id: 2, hit: false } });
    // 180 steps + 30 paused = 210, after invulnerability: it hits.
    expect(closed(3)).toEqual({ frame: 210, event: { type: 'RingClosed', id: 3, hit: true } });
  });

  it('pauses on Pause and resumes without time passing', () => {
    const g = setup([[spawn('grunt')]]);
    g.stepN(10);
    expect(g.step([{ type: 'pause' }])).toEqual([{ type: 'Paused' }]);
    g.stepN(500);
    g.step([aimAt(g.game, vec(0, 1, 10))]);
    expect(g.game.state.frame).toBe(10);
    expect(g.game.state.weapon.ammo).toBe(6);
    expect(g.step([{ type: 'pause' }])[0]).toEqual({ type: 'Resumed' });
    expect(g.game.state.frame).toBe(11);
  });

  it('clears the stage when the last enemy dies', () => {
    const g = setup([[spawn('grunt')]]);
    g.step();
    const events = g.shootBody(1);
    expect(events).toContainEqual({
      type: 'EnemyHit',
      id: 1,
      zone: 'body',
      points: 200,
      killed: true,
      disarmed: false,
    });
    expect(events.slice(-2)).toEqual([
      { type: 'WaveCleared', stop: 0, wave: 0 },
      { type: 'StageCleared', score: 200 },
    ]);
    expect(g.game.state.phase).toBe('stageClear');
    expect(g.step()).toEqual([]);
  });

  it('scores head shots and disarms on the gun hand', () => {
    const g = setup([[spawn('grunt'), spawn('grunt', 'Spawn_Left')]]);
    g.step();
    const z1 = hitZones(g.actor(1), g.t.body);
    const z2 = hitZones(g.actor(2), g.t.body);
    expect(g.shoot(z1.head.center)).toContainEqual(
      expect.objectContaining({ type: 'EnemyHit', zone: 'head', points: 300 }),
    );
    g.stepN(8);
    expect(g.shoot(z2.hand.center)).toContainEqual(
      expect.objectContaining({
        type: 'EnemyHit',
        zone: 'gun_hand',
        points: 500,
        disarmed: true,
        killed: false,
      }),
    );
    expect(g.actor(2).phase).toBe('disarmed');
    expect(g.game.state.phase).toBe('stageClear');
  });

  it('takes 3 hits to drop a heavy', () => {
    const g = setup([[spawn('heavy')]]);
    g.step();
    const killed: boolean[] = [];
    for (let i = 0; i < 3; i++) {
      for (const e of g.shootBody(1)) if (e.type === 'EnemyHit') killed.push(e.killed);
      g.stepN(8);
    }
    expect(killed).toEqual([false, false, true]);
  });

  it('costs a life and breaks the combo when a civilian is shot', () => {
    const g = setup([[spawn('grunt', 'Spawn_Left'), spawn('civilian', 'Spawn_Mid')]]);
    g.step();
    const events = g.shootBody(2);
    expect(events).toContainEqual({ type: 'CivilianHit', id: 2 });
    expect(events).toContainEqual({ type: 'PlayerHit', lives: 4, cause: 'civilian' });
    expect(g.game.state.invulnerable).toBe(0);
    expect(g.actor(2).phase).toBe('fled');
  });

  it('breaks the combo on a miss and on cover', () => {
    const g = setup([[spawn('grunt'), spawn('grunt', 'Spawn_Left'), spawn('grunt', 'Spawn_Right')]]);
    g.step();
    g.shootBody(1);
    expect(g.game.state.score.streak).toBe(1);
    g.stepN(8);
    expect(g.shoot(vec(0, 20, 5))).toContainEqual({ type: 'Miss' });
    expect(g.game.state.score.streak).toBe(0);
    g.stepN(8);
    g.shootBody(2);
    g.stepN(8);
    expect(g.shoot(vec(0, 1, 30))).toContainEqual({ type: 'CoverHit', name: 'Cover_Box' });
    expect(g.game.state.score.streak).toBe(0);
    expect(g.game.state.score.shots).toBe(4);
  });

  it('dry-fires on empty and reloads in 0.35 s', () => {
    const g = setup([[spawn('heavy', 'Spawn_Left')]]);
    g.step();
    for (let i = 0; i < 6; i++) {
      g.shoot(vec(0, 20, 5));
      g.stepN(8);
    }
    expect(g.shoot(vec(0, 20, 5))).toEqual([{ type: 'DryFire' }]);
    expect(g.step([{ type: 'reload' }])).toContainEqual({ type: 'ReloadStarted' });
    g.stepN(20);
    expect(g.at('Reloaded')).toHaveLength(0);
    g.step();
    expect(g.at('Reloaded')).toHaveLength(1);
    expect(g.game.state.weapon.ammo).toBe(6);
  });

  it('sends civilians away after their stay time, or when the wave clears', () => {
    const g = setup([[spawn('grunt', 'Spawn_Left', { aim_time: 9 }), spawn('civilian', 'Spawn_Mid')]]);
    // Timed phases count the step they start on: spawned on step 1, it leaves on its 180th step.
    g.stepN(180);
    expect(g.at('CivilianLeft')).toEqual([{ frame: 180, event: { type: 'CivilianLeft', id: 2 } }]);

    const h = setup([[spawn('grunt', 'Spawn_Left'), spawn('civilian', 'Spawn_Mid')]]);
    h.step();
    expect(h.shootBody(1)).toContainEqual({ type: 'CivilianLeft', id: 2 });
  });

  it('starts the next wave after the wave gap and drops resolved actors', () => {
    const g = setup([[spawn('grunt')], [spawn('runner', 'Spawn_Left', { delay: 0.5, entry: 'run_in' })]]);
    g.step();
    g.shootBody(1);
    g.stepN(29);
    expect(g.at('WaveStarted')).toHaveLength(1);
    g.step();
    expect(g.at('WaveStarted')[1]).toEqual({ frame: 32, event: { type: 'WaveStarted', stop: 0, wave: 1 } });
    expect(g.game.state.actors).toHaveLength(0);
    g.stepN(30);
    expect(g.at('EnemySpawned')).toHaveLength(2);
    expect(g.actor(2).phase).toBe('entering');
  });

  it('awards a bonus life at a threshold', () => {
    const t = tuning();
    t.player.bonus_lives_at = [200, 400];
    const g = setup([[spawn('grunt'), spawn('grunt', 'Spawn_Left')]], { tuning: t });
    g.step();
    expect(g.shootBody(1)).toContainEqual({ type: 'BonusLife', lives: 6 });
  });

  it('ends the game on the last life and then ignores input', () => {
    const t = tuning();
    t.difficulty.normal.lives = 1;
    const g = setup([[spawn('grunt', 'Spawn_Left'), spawn('civilian', 'Spawn_Mid')]], { tuning: t });
    g.step();
    const civ = bodyCenter(g.actor(2), t);
    const events = g.step([aimAt(g.game, civ), { type: 'reload' }]);
    expect(events.slice(-2)).toEqual([
      { type: 'PlayerHit', lives: 0, cause: 'civilian' },
      { type: 'GameOver', score: 0 },
    ]);
    expect(g.game.state.phase).toBe('gameOver');
    expect(g.step([{ type: 'reload' }])).toEqual([]);
  });

  it('scales aim time and lives by difficulty', () => {
    const easy = setup([[spawn('grunt')]], { difficulty: 'easy' });
    const hard = setup([[spawn('grunt')]], { difficulty: 'hard' });
    easy.step();
    hard.step();
    expect(easy.actor(1).aimFrames).toBe(150);
    expect(hard.actor(1).aimFrames).toBe(102);
    expect(easy.game.state.lives).toBe(7);
    expect(hard.game.state.lives).toBe(3);
  });

  it('can start at a later stop for debugging', () => {
    const game = newGame({ startStop: 3 });
    expect(game.state.stop).toBe(3);
    expect(game.state.camera.pathOffset).toBe(36);
    expect(runUntil(game, (e) => e.type === 'StopReached')).toContainEqual({ type: 'StopReached', stop: 3 });
    expect(() => newGame({ startStop: 9 })).toThrow(/startStop/);
    expect(() => newGame({ startStop: 1.5 })).toThrow(/startStop/);
  });

  it('never loses a life in god mode', () => {
    const t = tuning();
    const game = createGame({
      stage: stageWith([[spawn('grunt'), spawn('civilian', 'Spawn_Left')]]),
      markers,
      tuning: t,
      difficulty: 'normal',
      seed: 1,
      god: true,
    });
    game.step();
    const civ = game.state.actors.find((a) => a.civilian)!;
    const events = game.step([aimAt(game, bodyCenter(civ, t))]);
    expect(events).toContainEqual({ type: 'CivilianHit', id: 2 });
    for (let i = 0; i < 600; i++) events.push(...game.step());
    expect(events.filter((e) => e.type === 'PlayerHit')).toEqual([]);
    expect(events).toContainEqual({ type: 'RingClosed', id: 1, hit: false });
    expect(game.state.lives).toBe(5);
  });

  it('rejects an invalid stage', () => {
    expect(() => createGame({ stage: {}, markers, tuning: tuning(), difficulty: 'normal', seed: 1 })).toThrow(
      /Invalid stage/,
    );
  });
});
