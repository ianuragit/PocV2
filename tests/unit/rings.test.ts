import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/sim/rng';
import { advanceRings, promoteWaiting, ringsOf } from '../../src/sim/rings';
import { vec } from '../../src/sim/vec';
import type { Actor } from '../../src/sim/types';
import { tuning } from '../helpers';

const waiting = (id: number, queuedAt = 0, shots = 0): Actor => ({
  id,
  type: 'grunt',
  civilian: false,
  position: vec(0, 0, 0),
  yaw: 0,
  phase: 'waiting',
  timer: 0,
  hitsLeft: 1,
  aimFrames: 100,
  ringFrames: 100,
  ringElapsed: 0,
  queuedAt,
  shots,
});

describe('rings', () => {
  it('never runs more rings than the difficulty allows, oldest in queue first', () => {
    const actors = [waiting(1, 5), waiting(2, 0), waiting(3, 9), waiting(4, 0)];
    const events = promoteWaiting(actors, 3, createRng(1), 0.1);
    expect(events.map((e) => e.type === 'RingStarted' && e.id)).toEqual([2, 4, 1]);
    expect(actors.filter((a) => a.phase === 'aiming')).toHaveLength(3);
    expect(promoteWaiting(actors, 3, createRng(1), 0.1)).toEqual([]);
  });

  it('uses the exact aim time first, then jitters re-aims within the range', () => {
    const first = [waiting(1)];
    promoteWaiting(first, 1, createRng(1), 0.1);
    expect(first[0]!.ringFrames).toBe(100);
    const rng = createRng(3);
    for (let i = 0; i < 200; i++) {
      const a = [waiting(1, 0, 1)];
      promoteWaiting(a, 1, rng, 0.1);
      expect(a[0]!.ringFrames).toBeGreaterThanOrEqual(90);
      expect(a[0]!.ringFrames).toBeLessThanOrEqual(110);
    }
  });

  it('closes a ring after exactly its aim time and shrinks it from 3x to 1x', () => {
    const t = tuning().rings;
    const actors = [waiting(1)];
    promoteWaiting(actors, 1, createRng(1), 0);
    expect(ringsOf(actors, t)[0]).toEqual({ id: 1, progress: 0, scale: 3 });
    for (let i = 0; i < 49; i++) expect(advanceRings(actors)).toEqual([]);
    advanceRings(actors);
    expect(ringsOf(actors, t)[0]!.scale).toBeCloseTo(2);
    for (let i = 0; i < 49; i++) expect(advanceRings(actors)).toEqual([]);
    expect(advanceRings(actors).map((a) => a.id)).toEqual([1]);
    expect(ringsOf(actors, t)[0]!.scale).toBe(1);
  });
});
