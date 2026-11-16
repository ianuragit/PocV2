import type { Game } from '../../src/sim/game.ts';
import { hitZones } from '../../src/sim/shots.ts';
import type { Actor, GameEvent, Input, Tuning } from '../../src/sim/types.ts';
import type { Vec3 } from '../../src/sim/vec.ts';
import { aimAt, bodyCenter } from '../helpers.ts';

export interface BotResult {
  steps: number;
  events: { frame: number; event: GameEvent }[];
}

const HITTABLE = new Set(['entering', 'waiting', 'aiming', 'flying']);

/** Where the bot aims: thrown objects themselves, shield carriers in the head, everyone else in the body. */
function aimPoint(a: Actor, tuning: Tuning): Vec3 {
  if (a.role === 'projectile') return a.position;
  if (tuning.enemies[a.type]?.shield) return hitZones(a, tuning.body).head.center;
  return bodyCenter(a, tuning);
}

/**
 * The clearing bot: shoots each hostile `reactionSeconds` after it appears, thrown objects first,
 * then in spawn order, and reloads the moment the cylinder is empty. It never shoots civilians
 * or crates, so its score is a pure revolver run.
 */
export function runClearingBot(
  game: Game,
  tuning: Tuning,
  reactionSeconds = 0.5,
  maxSteps = 100_000,
): BotResult {
  const reaction = Math.round(reactionSeconds * tuning.step_hz);
  const spawnedAt = new Map<number, number>();
  const events: BotResult['events'] = [];
  let inputs: Input[] = [];
  for (let i = 0; i < maxSteps; i++) {
    const out = game.step(inputs);
    const { state } = game;
    for (const e of out) {
      events.push({ frame: state.frame, event: e });
      if (e.type === 'EnemySpawned') spawnedAt.set(e.id, state.frame);
    }
    if (state.phase === 'stageClear' || state.phase === 'gameOver') return { steps: i + 1, events };

    inputs = [];
    if (state.weapon.ammo === 0) {
      if (state.weapon.reloading === 0) inputs.push({ type: 'reload' });
      continue;
    }
    for (const a of state.actors) if (!spawnedAt.has(a.id)) spawnedAt.set(a.id, state.frame);
    const target = state.actors
      .filter(
        (a) => (a.role === 'enemy' || a.role === 'boss' || a.role === 'projectile') && HITTABLE.has(a.phase),
      )
      .filter((a) => state.frame - spawnedAt.get(a.id)! >= reaction)
      .sort((a, b) => Number(b.role === 'projectile') - Number(a.role === 'projectile') || a.id - b.id)[0];
    if (target) inputs.push(aimAt(game, aimPoint(target, tuning)));
  }
  throw new Error('clearing bot: stage never ended');
}

/** The idle bot never fires. It must lose, and must never hang. */
export function runIdleBot(game: Game, maxSteps = 100_000): BotResult {
  const events: BotResult['events'] = [];
  for (let i = 0; i < maxSteps; i++) {
    for (const e of game.step()) events.push({ frame: game.state.frame, event: e });
    if (game.state.phase === 'gameOver' || game.state.phase === 'stageClear') return { steps: i + 1, events };
  }
  throw new Error('idle bot: game never ended');
}
