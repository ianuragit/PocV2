import { describe, expect, it } from 'vitest';
import {
  createWeapon,
  dropSpecial,
  pickUp,
  startReload,
  tickWeapon,
  tryFire,
  weaponSpec,
  weaponSpecs,
  type Armoury,
} from '../../src/sim/weapons.ts';
import { tuning } from '../helpers.ts';

const spec = weaponSpec(tuning().revolver, 60);

describe('revolver', () => {
  it('derives frame timings from tuning', () => {
    expect(spec).toMatchObject({
      kind: 'revolver',
      capacity: 6,
      cooldownFrames: 8,
      reloadFrames: 21,
      reloadable: true,
    });
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

  it('never reloads a special weapon', () => {
    const specs = weaponSpecs(tuning());
    const w = createWeapon(specs.shotgun);
    tryFire(w, specs.shotgun);
    expect(startReload(w, specs.shotgun)).toBe(false);
    expect(specs.machine_pistol).toMatchObject({ capacity: 30, auto: true, cooldownFrames: 5 });
    expect(specs.magnum).toMatchObject({ pierce: true, cooldownFrames: 20 });
    expect(specs.shotgun.pellets).toBe(7);
  });

  it('stashes the revolver on pickup and gives it back on drop', () => {
    const specs = weaponSpecs(tuning());
    const armoury: Armoury = { current: createWeapon(specs.revolver), stashedRevolverAmmo: null };
    armoury.current.ammo = 2;
    pickUp(armoury, 'magnum', specs);
    expect(armoury.current).toMatchObject({ kind: 'magnum', ammo: 6, capacity: 6 });
    pickUp(armoury, 'shotgun', specs); // swapping specials keeps the stashed revolver
    dropSpecial(armoury, specs);
    expect(armoury.current).toMatchObject({ kind: 'revolver', ammo: 2, capacity: 6 });
    dropSpecial(armoury, specs); // no stash: a full revolver
    expect(armoury.current.ammo).toBe(6);
  });

  it('reloads instantly when reload time is zero', () => {
    const instant = weaponSpec({ capacity: 6, max_shots_per_second: 8, reload_time: 0 }, 60);
    const w = createWeapon(instant);
    tryFire(w, instant);
    expect(startReload(w, instant)).toBe(true);
    expect(w.ammo).toBe(6);
  });
});
