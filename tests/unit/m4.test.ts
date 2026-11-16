import { describe, expect, it } from 'vitest';
import { createGame } from '../../src/sim/game.ts';
import { hitZones } from '../../src/sim/shots.ts';
import { vec, type Vec3 } from '../../src/sim/vec.ts';
import type { GameEvent, Markers, SpawnDef, Tuning } from '../../src/sim/types.ts';
import { aimAt, bodyCenter, tuning } from '../helpers.ts';

const P = (x: number, y: number, z: number, yaw = Math.PI) => ({
  position: [x, y, z] as [number, number, number],
  rotation: [0, yaw, 0] as [number, number, number],
});
const markers: Markers = {
  Path_000: P(0, 1.6, 0),
  Path_001: P(0, 1.6, 20),
  Look_A: P(0, 1.2, 10),
  Spawn_Mid: P(0, 0, 10),
  Spawn_Near: P(0, 0, 7),
  Spawn_L: P(0.45, 0, 10),
  Spawn_R: P(-0.45, 0, 10),
  Spawn_Far: P(4, 0, 14),
  Spawn_Away: P(0, 0, 10, 0),
  Spawn_B1: P(0, 0, 12),
  Spawn_B2: P(3, 0, 12),
  Spawn_B3: P(-3, 0, 12),
  Crate_Box: P(2, 0, 6),
  Spawn_PA: P(-3.2, 0, 8),
  Spawn_PB: P(-4.8, 0, 12),
  // Off to the side, so only the magnum test shoots through it.
  Cover_Wall: { ...P(-2, 1, 5), scale: [0.6, 1, 0.2] },
};
const sp = (type: string, marker: string, extra: Partial<SpawnDef> = {}): SpawnDef => ({
  type,
  marker,
  entry: 'appear',
  delay: 0,
  ...extra,
});
const stageWith = (waves: SpawnDef[][]) => ({
  id: 't',
  name: 'T',
  environment: 'procedural',
  music: 'x',
  rank_thresholds: { S: 30000, A: 20000, B: 10000 },
  scenes: [
    {
      id: 'a',
      stops: [
        { path_offset: 0, travel_speed: 4, look_at: 'Look_A', waves: waves.map((spawns) => ({ spawns })) },
      ],
    },
  ],
});

function setup(waves: SpawnDef[][], t: Tuning = tuning()) {
  const game = createGame({ stage: stageWith(waves), markers, tuning: t, difficulty: 'normal', seed: 3 });
  const log: GameEvent[] = [];
  const step = (inputs: Parameters<typeof game.step>[0] = []) => {
    const e = game.step(inputs);
    log.push(...e);
    return e;
  };
  const steps = (n: number) => {
    const out: GameEvent[] = [];
    for (let i = 0; i < n; i++) out.push(...step());
    return out;
  };
  const shoot = (p: Vec3) => step([aimAt(game, p)]);
  const actor = (id: number) => game.state.actors.find((a) => a.id === id)!;
  const types = (events: GameEvent[]) => events.map((e) => e.type);
  return { game, t, step, steps, shoot, actor, types, log };
}

describe('crates and special weapons', () => {
  it('shooting a crate hands over its weapon without touching the combo', () => {
    const g = setup([[sp('grunt', 'Spawn_Mid'), sp('crate', 'Crate_Box', { weapon: 'shotgun' })]]);
    g.step();
    const events = g.shoot(vec(2, 0.4, 6));
    expect(events).toContainEqual({ type: 'CrateOpened', id: 2, weapon: 'shotgun' });
    expect(events).toContainEqual({ type: 'WeaponPickedUp', weapon: 'shotgun' });
    expect(g.game.state.weapon).toMatchObject({ kind: 'shotgun', ammo: 6 });
    expect(g.game.state.score).toMatchObject({ score: 0, streak: 0, shotsOnTarget: 1 });
    expect(g.actor(2).phase).toBe('opened');
  });

  it('the shotgun hits two enemies side by side with one shot', () => {
    const g = setup([
      [sp('grunt', 'Spawn_L'), sp('grunt', 'Spawn_R'), sp('crate', 'Crate_Box', { weapon: 'shotgun' })],
    ]);
    g.step();
    g.shoot(vec(2, 0.4, 6));
    g.steps(8);
    // Aim between them: the centre pellet misses, the ring of pellets catches both.
    const events = g.shoot(vec(0, 0.8, 10));
    const ids = events.flatMap((e) => (e.type === 'EnemyHit' ? [e.id] : []));
    expect(ids.sort()).toEqual([1, 2]);
    expect(g.game.state.score).toMatchObject({ shots: 2, shotsOnTarget: 2, hits: 3 });
  });

  it('a special is dropped when empty and the revolver comes back as it was', () => {
    const g = setup([
      [sp('heavy', 'Spawn_Far', { aim_time: 30 }), sp('crate', 'Crate_Box', { weapon: 'shotgun' })],
    ]);
    g.step();
    g.shoot(vec(0, 20, 5)); // spend one revolver round first
    g.steps(30);
    g.shoot(vec(2, 0.4, 6));
    expect(g.step([{ type: 'reload' }])).not.toContainEqual({ type: 'ReloadStarted' });
    const all: GameEvent[] = [];
    for (let i = 0; i < 6; i++) {
      g.steps(30);
      all.push(...g.shoot(vec(0, 20, 5)));
    }
    expect(all).toContainEqual({ type: 'WeaponLost', weapon: 'shotgun', reason: 'empty' });
    expect(g.game.state.weapon).toMatchObject({ kind: 'revolver', ammo: 4 });
  });

  it('a special is lost when the player is hit', () => {
    const g = setup([[sp('grunt', 'Spawn_Far'), sp('crate', 'Crate_Box', { weapon: 'magnum' })]]);
    g.step();
    g.shoot(vec(2, 0.4, 6));
    const events = g.steps(130);
    expect(events).toContainEqual({ type: 'WeaponLost', weapon: 'magnum', reason: 'hit' });
    expect(g.game.state.weapon.kind).toBe('revolver');
  });

  it('the machine pistol fires at most 12 shots a second while held', () => {
    const g = setup([[sp('heavy', 'Spawn_Far'), sp('crate', 'Crate_Box', { weapon: 'machine_pistol' })]]);
    g.step();
    g.shoot(vec(2, 0.4, 6));
    g.steps(10); // let the revolver's cooldown from the crate shot run out
    let shots = 0;
    for (let i = 0; i < 60; i++) shots += g.shoot(vec(0, 20, 5)).filter((e) => e.type === 'ShotFired').length;
    expect(shots).toBe(12);
  });

  it('the magnum pierces cover and every enemy on the line', () => {
    const g = setup([
      [sp('grunt', 'Spawn_Near'), sp('grunt', 'Spawn_Mid'), sp('crate', 'Crate_Box', { weapon: 'magnum' })],
    ]);
    g.step();
    g.shoot(vec(2, 0.4, 6));
    g.steps(20);
    const events = g.shoot(vec(0, 0.9, 10));
    expect(events.filter((e) => e.type === 'EnemyHit')).toHaveLength(2);
    expect(events).not.toContainEqual(expect.objectContaining({ type: 'CoverHit' }));
  });
});

describe('enemy types', () => {
  it('a shield blocks body shots from the front and breaks the combo; the head is open', () => {
    const g = setup([[sp('shield', 'Spawn_Far'), sp('grunt', 'Spawn_B3')]]);
    g.step();
    g.shoot(bodyCenter(g.actor(2), g.t));
    g.steps(8);
    expect(g.shoot(bodyCenter(g.actor(1), g.t))).toContainEqual({ type: 'ShieldBlock', id: 1 });
    expect(g.game.state.score.streak).toBe(0);
    g.steps(8);
    expect(g.shoot(hitZones(g.actor(1), g.t.body).head.center)).toContainEqual(
      expect.objectContaining({ type: 'EnemyHit', id: 1, zone: 'head', killed: true }),
    );
  });

  it('a shield seen from behind does not block', () => {
    const g = setup([[sp('shield', 'Spawn_Away')]]);
    g.step();
    expect(g.shoot(bodyCenter(g.actor(1), g.t))).toContainEqual(
      expect.objectContaining({ type: 'EnemyHit', zone: 'body' }),
    );
  });

  it('a thrower throws instead of shooting; the throw lands after its flight unless shot down', () => {
    const g = setup([[sp('thrower', 'Spawn_Mid')]]);
    const toThrow = g.steps(120);
    expect(toThrow).toContainEqual({ type: 'RingClosed', id: 1, hit: false });
    expect(toThrow).toContainEqual({ type: 'ProjectileThrown', id: 2, from: 1 });
    expect(g.types(toThrow)).not.toContain('PlayerHit');
    const flight = g.steps(150);
    expect(flight).toContainEqual({ type: 'ProjectileLanded', id: 2, hit: true });
    expect(flight).toContainEqual({ type: 'PlayerHit', lives: 4, cause: 'shot' });
  });

  it('a throw can be shot down for 100 points, and a wave waits for throws in the air', () => {
    const g = setup([[sp('thrower', 'Spawn_Mid')]]);
    g.steps(120);
    // Kill the thrower: the wave must not clear while its throw is still flying.
    expect(g.types(g.shoot(bodyCenter(g.actor(1), g.t)))).not.toContain('WaveCleared');
    g.steps(30);
    const p = g.actor(2);
    expect(p.phase).toBe('flying');
    expect(g.game.state.rings.map((r) => r.id)).toContain(2);
    const events = g.shoot(p.position);
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'EnemyHit', id: 2, zone: 'thrown', points: 100 }),
    );
    expect(g.types(events)).toContain('WaveCleared');
  });

  it('the vehicle gunner is a quick-firing enemy from data alone', () => {
    const g = setup([[sp('vehicle', 'Spawn_Mid')]]);
    g.step();
    expect(g.actor(1).aimFrames).toBe(108);
  });
});

describe('boss', () => {
  const bossSpawn = sp('boss', 'Spawn_B1', { phase_markers: ['Spawn_B1', 'Spawn_B2', 'Spawn_B3'] });

  it('takes three phases, moving between markers out of reach, then pays its bonus', () => {
    const t = tuning();
    t.boss.phases = [
      { hits: 2, aim_time: 3 },
      { hits: 2, aim_time: 3 },
      { hits: 1, aim_time: 3 },
    ];
    const g = setup([[bossSpawn]], t);
    g.step();
    const body = () => bodyCenter(g.actor(1), t);
    const hit = () => {
      const e = g.shoot(body());
      g.steps(8);
      return e;
    };
    hit();
    expect(hit()).toContainEqual({ type: 'BossPhase', id: 1, phase: 1 });
    expect(g.actor(1).phase).toBe('moving');
    expect(g.types(g.shoot(body()))).toContain('Miss'); // out of reach while moving
    g.steps(60);
    expect(g.actor(1).position).toEqual(vec(3, 0, 12));
    expect(g.actor(1).phase).toBe('aiming');
    hit();
    expect(hit()).toContainEqual({ type: 'BossPhase', id: 1, phase: 2 });
    g.steps(60);
    const before = g.game.state.score.score;
    const last = g.shoot(body());
    expect(last).toContainEqual({ type: 'BossDefeated', id: 1, bonus: 10_000 });
    expect(last).toContainEqual(expect.objectContaining({ type: 'StageCleared' }));
    // The miss while the boss was moving reset the combo, so the last hit is x1.
    expect(g.game.state.score.score - before).toBe(200 + 10_000);
  });

  it('cannot be disarmed: a gun-hand hit counts as a body hit', () => {
    const g = setup([[bossSpawn]]);
    g.step();
    const e = g.shoot(hitZones(g.actor(1), g.t.body).hand.center);
    expect(e).toContainEqual(
      expect.objectContaining({ type: 'EnemyHit', zone: 'body', disarmed: false, points: 200 }),
    );
  });
});

describe('continues', () => {
  const lastLife = () => {
    const t = tuning();
    t.difficulty.normal.lives = 1;
    return t;
  };

  it('offers a continue on the last life; accepting refills lives and restarts the score', () => {
    const g = setup([[sp('grunt', 'Spawn_Mid'), sp('grunt', 'Spawn_Far')]], lastLife());
    g.step();
    g.shoot(bodyCenter(g.actor(2), g.t));
    expect(g.game.state.score.score).toBe(200);
    const offer = g.steps(130);
    expect(offer).toContainEqual({ type: 'ContinueOffered', continuesLeft: 3, seconds: 10 });
    expect(g.game.state.phase).toBe('continue');
    const frozen = g.game.state.frame;
    g.steps(100);
    expect(g.game.state.frame).toBe(frozen);
    expect(g.step([{ type: 'continue' }])).toEqual([{ type: 'Continued', continuesLeft: 2 }]);
    expect(g.game.state).toMatchObject({ phase: 'combat', lives: 1, continuesLeft: 2, continuesUsed: 1 });
    expect(g.game.state.score.score).toBe(0);
  });

  it('ends the game when the countdown runs out or the player gives up', () => {
    const a = setup([[sp('grunt', 'Spawn_Mid')]], lastLife());
    a.steps(120);
    expect(a.types(a.steps(600))).toContain('GameOver');
    const b = setup([[sp('grunt', 'Spawn_Mid')]], lastLife());
    b.steps(120);
    expect(b.step([{ type: 'giveUp' }])).toEqual([{ type: 'GameOver', score: 0 }]);
  });

  it('goes straight to game over with no continues left', () => {
    const t = lastLife();
    t.player.continues = 0;
    const g = setup([[sp('grunt', 'Spawn_Mid')]], t);
    expect(g.types(g.steps(120))).toContain('GameOver');
  });
});
