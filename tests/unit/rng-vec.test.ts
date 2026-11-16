import { describe, expect, it } from 'vitest';
import { basis, fromArray, length, normalize, vec } from '../../src/sim/vec.ts';

describe('vec', () => {
  it('normalizes, including the zero vector', () => {
    expect(length(normalize(vec(3, 4, 0)))).toBeCloseTo(1);
    expect(normalize(vec(0, 0, 0))).toEqual(vec(0, 0, 0));
  });

  it('fills missing array entries with zero', () => {
    expect(fromArray([1])).toEqual(vec(1, 0, 0));
  });

  it('yaw 0 faces +Z with its right hand on -X', () => {
    const { forward, right } = basis(0);
    expect(forward).toEqual(vec(0, 0, 1));
    expect(right).toEqual(vec(-1, 0, 0));
  });
});
