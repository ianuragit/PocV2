import { readFileSync } from 'node:fs';
import { createGame, type Game } from '../src/sim/game.ts';
import { sub, type Vec3 } from '../src/sim/vec.ts';
import type { Actor, Difficulty, GameEvent, Input, Markers, Tuning } from '../src/sim/types.ts';

export const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;

export const tuning = (): Tuning => readJson<Tuning>('public/data/tuning.json');
export const stage1 = (): unknown => readJson('public/data/stages/stage1.json');
export const stage1Markers = (): Markers => readJson<Markers>('public/data/stages/stage1.markers.json');

export function newGame(
  opts: {
    difficulty?: Difficulty;
    seed?: number;
    tuning?: Tuning;
    stage?: unknown;
    markers?: Markers;
    startStop?: number;
  } = {},
): Game {
  return createGame({
    ...(opts.startStop !== undefined ? { startStop: opts.startStop } : {}),
    stage: opts.stage ?? stage1(),
    markers: opts.markers ?? stage1Markers(),
    tuning: opts.tuning ?? tuning(),
    difficulty: opts.difficulty ?? 'normal',
    seed: opts.seed ?? 42,
  });
}

export function bodyCenter(a: Actor, t: Tuning): Vec3 {
  return { x: a.position.x, y: a.position.y + (t.body.body_bottom + t.body.body_top) / 2, z: a.position.z };
}

export function aimAt(game: Game, target: Vec3): Input {
  const origin = game.state.camera.position;
  return { type: 'fire', origin, direction: sub(target, origin) };
}

/** Steps until a predicate on the emitted events holds. Returns all events seen. */
export function runUntil(game: Game, done: (e: GameEvent) => boolean, maxSteps = 10_000): GameEvent[] {
  const log: GameEvent[] = [];
  for (let i = 0; i < maxSteps; i++) {
    const events = game.step();
    log.push(...events);
    if (events.some(done)) return log;
  }
  throw new Error('runUntil: condition never met');
}
