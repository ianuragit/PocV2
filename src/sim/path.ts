import { fromArray, length, lerp, sub, type Vec3 } from './vec';
import type { Markers } from './types';

/**
 * The camera rail: Path_000, Path_001, ... joined in order.
 * M1 joins them with straight segments; the view may smooth the curve.
 */
export interface RailPath {
  readonly points: readonly Vec3[];
  readonly length: number;
  pointAt(distance: number): Vec3;
}

export function pathMarkerNames(markers: Markers): string[] {
  return Object.keys(markers)
    .filter((n) => /^Path_\d+$/.test(n))
    .sort((a, b) => Number(a.slice(5)) - Number(b.slice(5)));
}

export function createPath(points: readonly Vec3[]): RailPath {
  if (points.length === 0) throw new Error('A path needs at least one point.');
  const cumulative = [0];
  for (let i = 1; i < points.length; i++) {
    cumulative.push(cumulative[i - 1]! + length(sub(points[i]!, points[i - 1]!)));
  }
  const total = cumulative[cumulative.length - 1]!;
  return {
    points,
    length: total,
    pointAt(distance) {
      const d = Math.max(0, Math.min(total, distance));
      for (let i = 1; i < points.length; i++) {
        if (d <= cumulative[i]!) {
          const segment = cumulative[i]! - cumulative[i - 1]!;
          const t = segment === 0 ? 0 : (d - cumulative[i - 1]!) / segment;
          return lerp(points[i - 1]!, points[i]!, t);
        }
      }
      return points[points.length - 1]!;
    },
  };
}

export function pathFromMarkers(markers: Markers): RailPath {
  return createPath(pathMarkerNames(markers).map((n) => fromArray(markers[n]!.position)));
}
