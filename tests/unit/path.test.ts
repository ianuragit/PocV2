import { describe, expect, it } from 'vitest';
import { createPath, pathFromMarkers, pathMarkerNames } from '../../src/sim/path';
import { vec } from '../../src/sim/vec';
import type { Markers } from '../../src/sim/types';

const m = (x: number, z: number) => ({
  position: [x, 0, z] as [number, number, number],
  rotation: [0, 0, 0] as [number, number, number],
});

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

  it('measures length and interpolates by distance', () => {
    const path = createPath([vec(0, 0, 0), vec(0, 0, 10), vec(5, 0, 10)]);
    expect(path.length).toBe(15);
    expect(path.pointAt(5)).toEqual(vec(0, 0, 5));
    expect(path.pointAt(12)).toEqual(vec(2, 0, 10));
    expect(path.pointAt(-3)).toEqual(vec(0, 0, 0));
    expect(path.pointAt(99)).toEqual(vec(5, 0, 10));
  });

  it('handles repeated points and a single point', () => {
    expect(createPath([vec(1, 1, 1), vec(1, 1, 1)]).pointAt(0)).toEqual(vec(1, 1, 1));
    expect(createPath([vec(3, 0, 0)]).pointAt(2)).toEqual(vec(3, 0, 0));
  });

  it('builds from markers and rejects an empty path', () => {
    expect(pathFromMarkers({ Path_000: m(0, 0), Path_001: m(0, 4) }).length).toBe(4);
    expect(() => createPath([])).toThrow();
  });
});
