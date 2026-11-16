import { describe, expect, it } from 'vitest';
import { createPath, pathFromMarkers, pathMarkerNames } from '../../src/sim/path.ts';
import { length, sub, vec } from '../../src/sim/vec.ts';
import type { Markers } from '../../src/sim/types.ts';

const m = (x: number, z: number) => ({
  position: [x, 0, z] as [number, number, number],
  rotation: [0, 0, 0] as [number, number, number],
});
const close = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }, eps = 1e-6) =>
  length(sub(a, b)) < eps;

describe('rail path', () => {
  it('orders Path_ markers numerically and ignores others', () => {
    const markers: Markers = {
      Path_10: m(0, 0),
      Path_2: m(0, 0),
      Path_000: m(0, 0),
      Look_A: m(0, 0),
      Path_X: m(0, 0),
    };
    expect(pathMarkerNames(markers)).toEqual(['Path_000', 'Path_2', 'Path_10']);
  });

  it('is exact on a straight line', () => {
    const path = createPath([vec(0, 0, 0), vec(0, 0, 4), vec(0, 0, 10)]);
    expect(path.length).toBeCloseTo(10, 9);
    expect(close(path.pointAt(5), vec(0, 0, 5))).toBe(true);
    expect(path.pointAt(-3)).toEqual(vec(0, 0, 0));
    expect(close(path.pointAt(99), vec(0, 0, 10))).toBe(true);
  });

  it('passes through every control point and rounds the corners', () => {
    const pts = [vec(0, 0, 0), vec(0, 0, 10), vec(5, 0, 10)];
    const path = createPath(pts);
    // Through a right angle the curve bulges slightly past the corner: a little longer than the legs.
    expect(path.length).toBeLessThan(15 * 1.05);
    expect(path.length).toBeGreaterThan(Math.hypot(5, 10));
    expect(close(path.pointAt(0), pts[0]!)).toBe(true);
    expect(close(path.pointAt(path.length), pts[2]!)).toBe(true);
    // The middle control point is on the curve: some sample lies within a few millimetres of it.
    let nearest = Infinity;
    for (let d = 0; d <= path.length; d += 0.01)
      nearest = Math.min(nearest, length(sub(path.pointAt(d), pts[1]!)));
    expect(nearest).toBeLessThan(0.01);
  });

  it('moves smoothly: equal distance steps give equal-length moves', () => {
    const path = createPath([vec(0, 0, 0), vec(0, 0, 10), vec(6, 0, 16), vec(6, 0, 30)]);
    const step = 4 / 60;
    let prev = path.pointAt(0);
    for (let d = step; d < path.length; d += step) {
      const p = path.pointAt(d);
      expect(length(sub(p, prev))).toBeGreaterThan(step * 0.97);
      expect(length(sub(p, prev))).toBeLessThan(step * 1.001);
      prev = p;
    }
  });

  it('handles repeated points and a single point', () => {
    expect(createPath([vec(1, 1, 1), vec(1, 1, 1)]).pointAt(0)).toEqual(vec(1, 1, 1));
    expect(createPath([vec(3, 0, 0)]).pointAt(2)).toEqual(vec(3, 0, 0));
  });

  it('builds from markers and rejects an empty path', () => {
    expect(pathFromMarkers({ Path_000: m(0, 0), Path_001: m(0, 4) }).length).toBeCloseTo(4, 9);
    expect(() => createPath([])).toThrow();
  });
});
