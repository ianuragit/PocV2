import type { WeaponState } from './types.ts';

export interface WeaponSpec {
  capacity: number;
  cooldownFrames: number;
  reloadFrames: number;
}

export function weaponSpec(
  revolver: { capacity: number; max_shots_per_second: number; reload_time: number },
  hz: number,
): WeaponSpec {
  return {
    capacity: revolver.capacity,
    cooldownFrames: Math.max(1, Math.ceil(hz / revolver.max_shots_per_second)),
    reloadFrames: Math.round(revolver.reload_time * hz),
  };
}

export function createWeapon(spec: WeaponSpec): WeaponState {
  return { ammo: spec.capacity, capacity: spec.capacity, cooldown: 0, reloading: 0 };
}

export type FireResult = 'fired' | 'empty' | 'busy';

/** Tries to fire. 'busy' is a shot inside the rate limit or during a reload, and is ignored. */
export function tryFire(w: WeaponState, spec: WeaponSpec): FireResult {
  if (w.reloading > 0 || w.cooldown > 0) return 'busy';
  if (w.ammo <= 0) return 'empty';
  w.ammo -= 1;
  w.cooldown = spec.cooldownFrames;
  return 'fired';
}

/** Starts a reload unless one is running or the cylinder is full. */
export function startReload(w: WeaponState, spec: WeaponSpec): boolean {
  if (w.reloading > 0 || w.ammo === w.capacity) return false;
  w.reloading = spec.reloadFrames;
  if (w.reloading === 0) w.ammo = w.capacity;
  return true;
}

/** Advances timers by one step. Returns true on the step a reload completes. */
export function tickWeapon(w: WeaponState): boolean {
  if (w.cooldown > 0) w.cooldown -= 1;
  if (w.reloading > 0) {
    w.reloading -= 1;
    if (w.reloading === 0) {
      w.ammo = w.capacity;
      return true;
    }
  }
  return false;
}
