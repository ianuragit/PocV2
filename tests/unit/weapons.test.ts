import { describe, expect, it } from 'vitest';
import { createWeapon, startReload, tickWeapon, tryFire, weaponSpec } from '../../src/sim/weapons.ts';
import { tuning } from '../helpers.ts';

const spec = weaponSpec(tuning().revolver, 60);

describe('revolver', () => {
  it('derives frame timings from tuning', () => {
    expect(spec).toEqual({ capacity: 6, cooldownFrames: 8, reloadFrames: 21 });
  });

  it('never exceeds 8 shots per second', () => {
    const w = createWeapon(spec);
    let shots = 0;
    for (let frame = 0; frame < 60; frame++) {
      tickWeapon(w);
      if (tryFire(w, spec) === 'fired') shots++;
      if (w.ammo === 0) w.ammo = 6;
    }
    expect(shots).toBeLessThanOrEqual(8);
    expect(shots).toBeGreaterThanOrEqual(7);
  });

  it('reports busy inside the rate limit without spending ammo', () => {
    const w = createWeapon(spec);
    expect(tryFire(w, spec)).toBe('fired');
    expect(tryFire(w, spec)).toBe('busy');
    expect(w.ammo).toBe(5);
  });

  it('dry-fires when empty and reloads in 0.35 s', () => {
    const w = createWeapon(spec);
    for (let i = 0; i < 6; i++) {
      w.cooldown = 0;
      expect(tryFire(w, spec)).toBe('fired');
    }
    w.cooldown = 0;
    expect(tryFire(w, spec)).toBe('empty');
    expect(startReload(w, spec)).toBe(true);
    expect(startReload(w, spec)).toBe(false);
    expect(tryFire(w, spec)).toBe('busy');
    const done = Array.from({ length: 21 }, () => tickWeapon(w));
    expect(done.indexOf(true)).toBe(20);
    expect(w.ammo).toBe(6);
  });

  it('ignores reload on a full cylinder', () => {
    const w = createWeapon(spec);
    expect(startReload(w, spec)).toBe(false);
    expect(w.reloading).toBe(0);
  });

  it('reloads instantly when reload time is zero', () => {
    const instant = weaponSpec({ capacity: 6, max_shots_per_second: 8, reload_time: 0 }, 60);
    const w = createWeapon(instant);
    tryFire(w, instant);
    expect(startReload(w, instant)).toBe(true);
    expect(w.ammo).toBe(6);
  });
});
