import type { Game } from '../../src/sim/game';
import type { GameEvent, Input, Tuning } from '../../src/sim/types';
import { aimAt, bodyCenter } from '../helpers';

export interface BotResult {
  steps: number;
  events: { frame: number; event: GameEvent }[];
}

const HITTABLE = new Set(['entering', 'waiting', 'aiming']);

/**
 * The clearing bot: shoots each enemy in the body `reactionSeconds` after it spawns,
 * in spawn order, and reloads the moment the cylinder is empty. It never shoots civilians.
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
    const target = state.actors
      .filter((a) => !a.civilian && HITTABLE.has(a.phase) && state.frame - spawnedAt.get(a.id)! >= reaction)
      .sort((a, b) => a.id - b.id)[0];
    if (target) inputs.push(aimAt(game, bodyCenter(target, tuning)));
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
