import { pathFromMarkers, pathMarkerNames, type RailPath } from './path.ts';
import { add, fromArray, scale, sub, vec, type Vec3 } from './vec.ts';
import type { ActorRole, Markers, SpecialWeapon, StageDef, Tuning } from './types.ts';

export interface Box {
  name: string;
  min: Vec3;
  max: Vec3;
}

export function roleOf(type: string): ActorRole {
  return type === 'civilian' || type === 'crate' || type === 'boss' ? type : 'enemy';
}

export interface ResolvedSpawn {
  type: string;
  role: ActorRole;
  civilian: boolean;
  weapon?: SpecialWeapon;
  /** Boss: where it stands in each phase. */
  phases?: { position: Vec3; yaw: number }[];
  position: Vec3;
  yaw: number;
  entryFrames: number;
  delayFrames: number;
  /** Aim time override in seconds, before difficulty scaling. */
  aimTime?: number;
}

export interface ResolvedStop {
  pathOffset: number;
  /** Metres moved per simulation step while travelling to this stop. */
  stepDistance: number;
  lookAt: Vec3;
  waves: ResolvedSpawn[][];
}

export interface ResolvedStage {
  id: string;
  name: string;
  rankThresholds: StageDef['rank_thresholds'];
  path: RailPath;
  stops: ResolvedStop[];
  covers: Box[];
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

/**
 * Checks a parsed stage file against the format in docs/spec.md and against its markers.
 * Returns every problem found, so one run of `npm run validate` reports them all.
 */
export function validateStage(raw: unknown, markers: Markers, tuning: Tuning): string[] {
  const errors: string[] = [];
  const err = (path: string, msg: string) => errors.push(`${path}: ${msg}`);
  if (!isObject(raw)) return ['stage: must be an object'];

  for (const key of ['id', 'name', 'environment', 'music'] as const) {
    if (!isStr(raw[key])) err(key, 'must be a non-empty string');
  }

  const ranks = raw.rank_thresholds;
  if (!isObject(ranks) || !isNum(ranks.S) || !isNum(ranks.A) || !isNum(ranks.B)) {
    err('rank_thresholds', 'must have numeric S, A and B');
  } else if (!(ranks.B < ranks.A && ranks.A < ranks.S)) {
    err('rank_thresholds', 'must ascend: B < A < S');
  }

  const pathNames = pathMarkerNames(markers);
  if (pathNames.length < 2) err('markers', 'need at least two Path_ markers');
  const pathLength = pathNames.length >= 2 ? pathFromMarkers(markers).length : 0;

  const marker = (path: string, name: unknown, prefix: string) => {
    if (!isStr(name)) err(path, 'must be a marker name');
    else if (!name.startsWith(prefix)) err(path, `"${name}" must start with ${prefix}`);
    else if (!markers[name]) err(path, `marker "${name}" does not exist`);
  };

  if (!Array.isArray(raw.scenes) || raw.scenes.length === 0) {
    err('scenes', 'must be a non-empty array');
    return errors;
  }
  let lastOffset = -Infinity;
  raw.scenes.forEach((scene: unknown, si) => {
    const sp = `scenes[${si}]`;
    if (!isObject(scene)) return err(sp, 'must be an object');
    if (!isStr(scene.id)) err(`${sp}.id`, 'must be a non-empty string');
    if (!Array.isArray(scene.stops) || scene.stops.length === 0)
      return err(`${sp}.stops`, 'must be a non-empty array');
    scene.stops.forEach((stop: unknown, ti) => {
      const tp = `${sp}.stops[${ti}]`;
      if (!isObject(stop)) return err(tp, 'must be an object');
      if (!isNum(stop.path_offset) || stop.path_offset < 0) err(`${tp}.path_offset`, 'must be a number >= 0');
      else {
        if (stop.path_offset <= lastOffset)
          err(`${tp}.path_offset`, 'must be greater than the previous stop');
        if (stop.path_offset > pathLength)
          err(`${tp}.path_offset`, `is past the end of the path (${pathLength.toFixed(2)})`);
        lastOffset = stop.path_offset;
      }
      if (!isNum(stop.travel_speed) || stop.travel_speed <= 0)
        err(`${tp}.travel_speed`, 'must be a number > 0');
      marker(`${tp}.look_at`, stop.look_at, 'Look_');
      if (!Array.isArray(stop.waves) || stop.waves.length === 0)
        return err(`${tp}.waves`, 'must be a non-empty array');
      stop.waves.forEach((wave: unknown, wi) => {
        const wp = `${tp}.waves[${wi}]`;
        if (!isObject(wave) || !Array.isArray(wave.spawns) || wave.spawns.length === 0) {
          return err(`${wp}.spawns`, 'must be a non-empty array');
        }
        if (!wave.spawns.some((s: unknown) => isObject(s) && s.type !== 'civilian' && s.type !== 'crate')) {
          err(wp, 'needs at least one enemy, or it can never be cleared');
        }
        wave.spawns.forEach((spawn: unknown, xi) => {
          const xp = `${wp}.spawns[${xi}]`;
          if (!isObject(spawn)) return err(xp, 'must be an object');
          const known = spawn.type === 'civilian' || spawn.type === 'crate' || spawn.type === 'boss';
          if (!known && !(isStr(spawn.type) && tuning.enemies[spawn.type])) {
            err(`${xp}.type`, `unknown type "${String(spawn.type)}"`);
          }
          marker(`${xp}.marker`, spawn.marker, spawn.type === 'crate' ? 'Crate_' : 'Spawn_');
          if (spawn.type === 'crate') {
            if (!isStr(spawn.weapon) || !(spawn.weapon in tuning.specials)) {
              err(`${xp}.weapon`, `crates need a weapon: one of ${Object.keys(tuning.specials).join(', ')}`);
            }
          } else if (spawn.weapon !== undefined) {
            err(`${xp}.weapon`, 'only crates hold weapons');
          }
          if (spawn.type === 'boss') {
            const want = tuning.boss.phases.length;
            if (!Array.isArray(spawn.phase_markers) || spawn.phase_markers.length !== want) {
              err(`${xp}.phase_markers`, `the boss needs ${want} phase markers, one per phase`);
            } else {
              spawn.phase_markers.forEach((m: unknown, mi: number) =>
                marker(`${xp}.phase_markers[${mi}]`, m, 'Spawn_'),
              );
              if (spawn.phase_markers[0] !== spawn.marker)
                err(`${xp}.phase_markers[0]`, 'must be the same as marker');
            }
          } else if (spawn.phase_markers !== undefined) {
            err(`${xp}.phase_markers`, 'only the boss has phase markers');
          }
          if (!isStr(spawn.entry) || tuning.entries[spawn.entry] === undefined) {
            err(`${xp}.entry`, `unknown entry "${String(spawn.entry)}"`);
          }
          if (!isNum(spawn.delay) || spawn.delay < 0) err(`${xp}.delay`, 'must be a number >= 0');
          if (spawn.aim_time !== undefined && (!isNum(spawn.aim_time) || spawn.aim_time <= 0)) {
            err(`${xp}.aim_time`, 'must be a number > 0');
          }
        });
      });
    });
  });
  return errors;
}

/** Validates, then converts seconds to frames and marker names to positions. Throws on invalid data. */
export function resolveStage(raw: unknown, markers: Markers, tuning: Tuning): ResolvedStage {
  const errors = validateStage(raw, markers, tuning);
  if (errors.length > 0) throw new Error(`Invalid stage:\n${errors.join('\n')}`);
  const stage = raw as StageDef;
  const hz = tuning.step_hz;
  const frames = (seconds: number) => Math.round(seconds * hz);
  const pos = (name: string) => fromArray(markers[name]!.position);

  const stops: ResolvedStop[] = stage.scenes.flatMap((scene) =>
    scene.stops.map((stop) => ({
      pathOffset: stop.path_offset,
      stepDistance: stop.travel_speed / hz,
      lookAt: pos(stop.look_at),
      waves: stop.waves.map((wave) =>
        wave.spawns.map((s) => ({
          type: s.type,
          role: roleOf(s.type),
          civilian: s.type === 'civilian',
          position: pos(s.marker),
          yaw: markers[s.marker]!.rotation[1],
          entryFrames: frames(tuning.entries[s.entry]!),
          delayFrames: frames(s.delay),
          ...(s.aim_time !== undefined ? { aimTime: s.aim_time } : {}),
          ...(s.weapon !== undefined ? { weapon: s.weapon } : {}),
          ...(s.phase_markers
            ? { phases: s.phase_markers.map((m) => ({ position: pos(m), yaw: markers[m]!.rotation[1] })) }
            : {}),
        })),
      ),
    })),
  );

  const covers: Box[] = Object.entries(markers)
    .filter(([name]) => name.startsWith('Cover_'))
    .map(([name, m]) => {
      const center = fromArray(m.position);
      const half = m.scale ? fromArray(m.scale) : vec(0.5, 0.5, 0.5);
      return { name, min: sub(center, half), max: add(center, scale(half, 1)) };
    });

  return {
    id: stage.id,
    name: stage.name,
    rankThresholds: stage.rank_thresholds,
    path: pathFromMarkers(markers),
    stops,
    covers,
  };
}
