import type { Rng } from './rng.ts';
import type { Actor, GameEvent, Ring, Tuning } from './types.ts';

/**
 * Ring scheduling. At most `maxRings` enemies count down at once; the rest wait in a queue
 * ordered by when they joined it. After an enemy fires it rejoins the back of the queue.
 */
export function promoteWaiting(
  actors: readonly Actor[],
  maxRings: number,
  rng: Rng,
  jitter: number,
): GameEvent[] {
  const events: GameEvent[] = [];
  let aiming = actors.filter((a) => a.phase === 'aiming').length;
  const queue = actors
    .filter((a) => a.phase === 'waiting')
    .sort((a, b) => a.queuedAt - b.queuedAt || a.id - b.id);
  for (const actor of queue) {
    if (aiming >= maxRings) break;
    actor.phase = 'aiming';
    actor.ringElapsed = 0;
    // The first ring uses the exact aim time; later ones vary by +-jitter so enemies drift out of sync.
    actor.ringFrames =
      actor.shots === 0
        ? actor.aimFrames
        : Math.max(1, Math.round(actor.aimFrames * (1 + jitter * (2 * rng.next() - 1))));
    aiming++;
    events.push({ type: 'RingStarted', id: actor.id });
  }
  return events;
}

/** Advances every running ring by one step and returns the actors whose ring closed. */
export function advanceRings(actors: readonly Actor[]): Actor[] {
  const closed: Actor[] = [];
  for (const actor of actors) {
    if (actor.phase !== 'aiming') continue;
    actor.ringElapsed += 1;
    if (actor.ringElapsed >= actor.ringFrames) closed.push(actor);
  }
  return closed;
}

export function ringsOf(actors: readonly Actor[], rings: Tuning['rings']): Ring[] {
  return actors
    .filter((a) => a.phase === 'aiming')
    .map((a) => {
      const progress = Math.min(1, a.ringElapsed / a.ringFrames);
      return {
        id: a.id,
        progress,
        scale: rings.start_scale + (rings.end_scale - rings.start_scale) * progress,
      };
    });
}
