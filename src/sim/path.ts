import { add, fromArray, length, lerp, scale, sub, type Vec3 } from './vec.ts';
import type { Markers } from './types.ts';

/** Arc-length samples per metre of chord. Finer is smoother; 8 keeps the error well under 1 cm. */
const SAMPLES_PER_METRE = 8;

/**
 * The camera rail: Path_000, Path_001, ... joined in order by a centripetal Catmull-Rom curve
 * that passes through every marker. Positions are looked up by distance along the curve, so
 * stage data can say "stop 12.5 m along the rail" and travel speed is in metres per second.
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

/** Centripetal Catmull-Rom point between p1 and p2 at t in [0, 1] (Barry-Goldman form). */
function catmullRom(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, t: number): Vec3 {
  const knot = (a: Vec3, b: Vec3) => Math.max(1e-6, Math.sqrt(length(sub(b, a))));
  const t0 = 0;
  const t1 = t0 + knot(p0, p1);
  const t2 = t1 + knot(p1, p2);
  const t3 = t2 + knot(p2, p3);
  const u = t1 + (t2 - t1) * t;
  const mix = (a: Vec3, b: Vec3, ta: number, tb: number) =>
    add(scale(a, (tb - u) / (tb - ta)), scale(b, (u - ta) / (tb - ta)));
  const a1 = mix(p0, p1, t0, t1);
  const a2 = mix(p1, p2, t1, t2);
  const a3 = mix(p2, p3, t2, t3);
  const b1 = mix(a1, a2, t0, t2);
  const b2 = mix(a2, a3, t1, t3);
  return mix(b1, b2, t1, t2);
}

export function createPath(points: readonly Vec3[]): RailPath {
  if (points.length === 0) throw new Error('A path needs at least one point.');
  // Sample the curve densely, then measure it: samples[i] sits cumulative[i] metres along.
  const samples: Vec3[] = [points[0]!];
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    // Mirror the ends so the curve starts and finishes heading straight at its neighbour.
    const p0 = points[i - 1] ?? sub(scale(p1, 2), p2);
    const p3 = points[i + 2] ?? sub(scale(p2, 2), p1);
    const n = Math.max(1, Math.ceil(length(sub(p2, p1)) * SAMPLES_PER_METRE));
    for (let k = 1; k <= n; k++)
      samples.push(length(sub(p2, p1)) === 0 ? p2 : catmullRom(p0, p1, p2, p3, k / n));
  }
  const cumulative = [0];
  for (let i = 1; i < samples.length; i++) {
    cumulative.push(cumulative[i - 1]! + length(sub(samples[i]!, samples[i - 1]!)));
  }
  const total = cumulative[cumulative.length - 1]!;

  return {
    points,
    length: total,
    pointAt(distance) {
      const d = Math.max(0, Math.min(total, distance));
      // Binary search for the sample segment containing d.
      let lo = 0;
      let hi = samples.length - 1;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (cumulative[mid]! <= d) lo = mid;
        else hi = mid;
      }
      const segment = cumulative[hi]! - cumulative[lo]!;
      const t = segment === 0 ? 0 : (d - cumulative[lo]!) / segment;
      return lerp(samples[lo]!, samples[hi]!, t);
    },
  };
}

export function pathFromMarkers(markers: Markers): RailPath {
  return createPath(pathMarkerNames(markers).map((n) => fromArray(markers[n]!.position)));
}
