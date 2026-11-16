import type { SpecialWeapon, Tuning, WeaponDef, WeaponKind, WeaponState } from './types.ts';

export interface WeaponSpec {
  kind: WeaponKind;
  capacity: number;
  cooldownFrames: number;
  /** 0 for specials: they are dropped when empty instead of reloaded. */
  reloadFrames: number;
  reloadable: boolean;
  pellets: number;
  spreadRadians: number;
  auto: boolean;
  pierce: boolean;
}

export function weaponSpec(def: WeaponDef, hz: number, kind: WeaponKind = 'revolver'): WeaponSpec {
  return {
    kind,
    capacity: def.capacity,
    cooldownFrames: Math.max(1, Math.ceil(hz / def.max_shots_per_second)),
    reloadFrames: Math.round((def.reload_time ?? 0) * hz),
    reloadable: def.reload_time !== undefined,
    pellets: def.pellets ?? 1,
    spreadRadians: ((def.spread_deg ?? 0) * Math.PI) / 180,
    auto: def.auto ?? false,
    pierce: def.pierce ?? false,
  };
}

/** Every weapon's spec, keyed by kind. */
export function weaponSpecs(tuning: Tuning): Record<WeaponKind, WeaponSpec> {
  const hz = tuning.step_hz;
  return {
    revolver: weaponSpec(tuning.revolver, hz, 'revolver'),
    shotgun: weaponSpec(tuning.specials.shotgun, hz, 'shotgun'),
    machine_pistol: weaponSpec(tuning.specials.machine_pistol, hz, 'machine_pistol'),
    magnum: weaponSpec(tuning.specials.magnum, hz, 'magnum'),
  };
}

export function createWeapon(spec: WeaponSpec): WeaponState {
  return { kind: spec.kind, ammo: spec.capacity, capacity: spec.capacity, cooldown: 0, reloading: 0 };
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

/** Starts a reload unless one is running, the cylinder is full, or the weapon is a special. */
export function startReload(w: WeaponState, spec: WeaponSpec): boolean {
  if (!spec.reloadable || w.reloading > 0 || w.ammo === w.capacity) return false;
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

/**
 * The player's gun. Holds the revolver's state while a special weapon is in hand, so dropping
 * the special gives back the revolver exactly as it was (minus any reload in progress).
 */
export interface Armoury {
  current: WeaponState;
  stashedRevolverAmmo: number | null;
}

export function pickUp(
  armoury: Armoury,
  special: SpecialWeapon,
  specs: Record<WeaponKind, WeaponSpec>,
): void {
  if (armoury.current.kind === 'revolver') armoury.stashedRevolverAmmo = armoury.current.ammo;
  const cooldown = armoury.current.cooldown;
  Object.assign(armoury.current, createWeapon(specs[special]), { cooldown });
}

export function dropSpecial(armoury: Armoury, specs: Record<WeaponKind, WeaponSpec>): void {
  const ammo = armoury.stashedRevolverAmmo ?? specs.revolver.capacity;
  const cooldown = armoury.current.cooldown;
  Object.assign(armoury.current, createWeapon(specs.revolver), { ammo, cooldown });
  armoury.stashedRevolverAmmo = null;
}
