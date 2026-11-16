import { describe, expect, it } from 'vitest';
import { resolveStage, validateStage } from '../../src/sim/stage.ts';
import type { StageDef } from '../../src/sim/types.ts';
import { stage1, stage1Markers, tuning } from '../helpers.ts';

const t = tuning();
const markers = stage1Markers();
const edit = (fn: (s: StageDef) => void): StageDef => {
  const s = stage1() as StageDef;
  fn(s);
  return s;
};
const errorsFor = (fn: (s: StageDef) => void) => validateStage(edit(fn), markers, t);
const firstSpawn = (s: StageDef) => s.scenes[0]!.stops[0]!.waves[0]!.spawns[0]!;

describe('validateStage', () => {
  it('accepts stage 1', () => {
    expect(validateStage(stage1(), markers, t)).toEqual([]);
  });

  it('fails when a stage names a marker that does not exist', () => {
    expect(errorsFor((s) => (firstSpawn(s).marker = 'Spawn_Nowhere'))).toEqual([
      'scenes[0].stops[0].waves[0].spawns[0].marker: marker "Spawn_Nowhere" does not exist',
    ]);
    expect(errorsFor((s) => (s.scenes[0]!.stops[0]!.look_at = 'Spawn_Gate'))[0]).toMatch(
      /must start with Look_/,
    );
  });

  it('rejects unknown types and entries, bad delays and aim times', () => {
    const errors = errorsFor((s) => {
      const sp = firstSpawn(s);
      sp.type = 'dragon';
      sp.entry = 'teleport';
      sp.delay = -1;
      sp.aim_time = 0;
    });
    expect(errors.join('\n')).toMatch(/unknown type "dragon"/);
    expect(errors.join('\n')).toMatch(/unknown entry "teleport"/);
    expect(errors.join('\n')).toMatch(/delay: must be a number >= 0/);
    expect(errors.join('\n')).toMatch(/aim_time: must be a number > 0/);
  });

  it('requires stop offsets to ascend and stay on the path', () => {
    expect(errorsFor((s) => (s.scenes[0]!.stops[1]!.path_offset = 1)).join()).toMatch(
      /greater than the previous stop/,
    );
    expect(errorsFor((s) => (s.scenes[1]!.stops[1]!.path_offset = 500)).join()).toMatch(
      /past the end of the path/,
    );
    expect(errorsFor((s) => (s.scenes[0]!.stops[0]!.travel_speed = 0)).join()).toMatch(/travel_speed/);
  });

  it('requires rank thresholds to ascend', () => {
    expect(errorsFor((s) => (s.rank_thresholds = { S: 1, A: 2, B: 3 }))).toEqual([
      'rank_thresholds: must ascend: B < A < S',
    ]);
    expect(errorsFor((s) => delete (s as Partial<StageDef>).rank_thresholds)[0]).toMatch(
      /numeric S, A and B/,
    );
  });

  it('rejects a wave that holds only civilians', () => {
    const errors = errorsFor((s) => {
      s.scenes[0]!.stops[0]!.waves[0]!.spawns = [
        { type: 'civilian', marker: 'Spawn_StreetCivilian', entry: 'appear', delay: 0 },
      ];
    });
    expect(errors).toEqual([
      'scenes[0].stops[0].waves[0]: needs at least one enemy, or it can never be cleared',
    ]);
  });

  it('checks crates: a weapon from tuning and a Crate_ marker', () => {
    const m = {
      ...markers,
      Crate_A: {
        position: [0, 0, 5] as [number, number, number],
        rotation: [0, 0, 0] as [number, number, number],
      },
    };
    const withSpawn = (extra: Record<string, unknown>) => {
      const st = stage1() as StageDef;
      st.scenes[0]!.stops[0]!.waves[0]!.spawns.push({
        type: 'crate',
        marker: 'Crate_A',
        entry: 'appear',
        delay: 0,
        ...extra,
      } as never);
      return validateStage(st, m, t).join('\n');
    };
    expect(withSpawn({ weapon: 'shotgun' })).toBe('');
    expect(withSpawn({ weapon: 'laser' })).toMatch(/crates need a weapon/);
    expect(withSpawn({ weapon: 'shotgun', marker: 'Spawn_Doorway' })).toMatch(/must start with Crate_/);
    expect(errorsFor((st) => (firstSpawn(st).weapon = 'shotgun')).join()).toMatch(/only crates hold weapons/);
  });

  it('checks the boss: one phase marker per phase, starting at its marker', () => {
    const withBoss = (phase_markers: unknown, marker = 'Spawn_DepotCentre') => {
      const st = stage1() as StageDef;
      st.scenes[0]!.stops[0]!.waves[0]!.spawns.push({
        type: 'boss',
        marker,
        entry: 'appear',
        delay: 0,
        phase_markers,
      } as never);
      return validateStage(st, markers, t).join('\n');
    };
    const three = ['Spawn_DepotCentre', 'Spawn_DepotLeft', 'Spawn_DepotBack'];
    expect(withBoss(three)).toBe('');
    expect(withBoss(three.slice(0, 2))).toMatch(/needs 3 phase markers/);
    expect(withBoss(three, 'Spawn_DepotLeft')).toMatch(/must be the same as marker/);
    expect(withBoss(['Spawn_DepotCentre', 'Spawn_Nope', 'Spawn_DepotBack'])).toMatch(
      /"Spawn_Nope" does not exist/,
    );
    expect(errorsFor((st) => (firstSpawn(st).phase_markers = three)).join()).toMatch(
      /only the boss has phase markers/,
    );
  });

  it('reports structural problems', () => {
    expect(validateStage(null, markers, t)).toEqual(['stage: must be an object']);
    expect(validateStage({}, {}, t)).toEqual(
      expect.arrayContaining([
        'id: must be a non-empty string',
        'markers: need at least two Path_ markers',
        'scenes: must be a non-empty array',
      ]),
    );
    const broken = {
      ...(stage1() as object),
      scenes: [5, { stops: [] }, { id: 'x', stops: [7, { waves: [] }, { waves: [{}, { spawns: [3] }] }] }],
    };
    const errors = validateStage(broken, markers, t).join('\n');
    expect(errors).toMatch(/scenes\[0\]: must be an object/);
    expect(errors).toMatch(/scenes\[1\]\.stops: must be a non-empty array/);
    expect(errors).toMatch(/scenes\[2\]\.stops\[0\]: must be an object/);
    expect(errors).toMatch(/scenes\[2\]\.stops\[1\]\.waves: must be a non-empty array/);
    expect(errors).toMatch(/scenes\[2\]\.stops\[2\]\.waves\[0\]\.spawns: must be a non-empty array/);
    expect(errors).toMatch(/scenes\[2\]\.stops\[2\]\.waves\[1\]\.spawns\[0\]: must be an object/);
  });
});

describe('resolveStage', () => {
  it('converts seconds to frames and marker names to positions', () => {
    const r = resolveStage(stage1(), markers, t);
    expect(r.stops).toHaveLength(10);
    const second = r.stops[0]!.waves[0]![1]!;
    expect(second).toMatchObject({
      type: 'runner',
      delayFrames: 36,
      entryFrames: 48,
      position: { x: 3, y: 0, z: 16 },
    });
    expect(second.aimTime).toBeUndefined();
    expect(r.stops[0]!.waves[0]![2]!.civilian).toBe(true);
    expect(r.stops[0]!.stepDistance).toBeCloseTo(4 / 60);
    expect(r.covers.map((c) => c.name).sort()).toEqual([
      'Cover_Barrier',
      'Cover_Cart',
      'Cover_CoffeeKiosk',
      'Cover_CrateStack',
      'Cover_DepotCrates',
      'Cover_Newsstand',
    ]);
    const barrier = r.covers.find((c) => c.name === 'Cover_Barrier')!;
    expect(barrier.min.x).toBeCloseTo(8.5);
    expect(barrier.max.y).toBeCloseTo(1.1);
  });

  it('gives cover boxes without a scale a unit size', () => {
    const m = {
      ...markers,
      Cover_Crate: {
        position: [0, 0, 0] as [number, number, number],
        rotation: [0, 0, 0] as [number, number, number],
      },
    };
    expect(resolveStage(stage1(), m, t).covers.find((c) => c.name === 'Cover_Crate')!.max).toEqual({
      x: 0.5,
      y: 0.5,
      z: 0.5,
    });
  });

  it('throws with every error listed', () => {
    expect(() => resolveStage({}, markers, t)).toThrow(/Invalid stage:\nid: must be a non-empty string/);
  });
});
