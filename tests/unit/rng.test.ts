import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/sim/rng';

describe('createRng', () => {
  it('is deterministic for a given seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = Array.from({ length: 100 }, () => a.next());
    const seqB = Array.from({ length: 100 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('differs between seeds', () => {
    expect(createRng(1).next()).not.toEqual(createRng(2).next());
  });

  it('stays in range', () => {
    const r = createRng(7);
    for (let i = 0; i < 10_000; i++) {
      const f = r.next();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      const n = r.int(3, 5);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(5);
    }
  });
});
