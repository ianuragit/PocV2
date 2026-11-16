/** Minimal 3D vector maths for the simulation. Plain objects, no classes, no allocation tricks. */
export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export const vec = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
export const fromArray = (a: readonly number[]): Vec3 => vec(a[0] ?? 0, a[1] ?? 0, a[2] ?? 0);
export const add = (a: Vec3, b: Vec3): Vec3 => vec(a.x + b.x, a.y + b.y, a.z + b.z);
export const sub = (a: Vec3, b: Vec3): Vec3 => vec(a.x - b.x, a.y - b.y, a.z - b.z);
export const scale = (a: Vec3, s: number): Vec3 => vec(a.x * s, a.y * s, a.z * s);
export const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
export const length = (a: Vec3): number => Math.sqrt(dot(a, a));
export const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => add(a, scale(sub(b, a), t));

export function normalize(a: Vec3): Vec3 {
  const l = length(a);
  return l === 0 ? vec(0, 0, 0) : scale(a, 1 / l);
}

/** Unit vectors for a facing angle around +Y, in Three.js axes: yaw 0 faces +Z, and its right hand is on -X. */
export function basis(yaw: number): { forward: Vec3; right: Vec3 } {
  const s = Math.sin(yaw);
  const c = Math.cos(yaw);
  return { forward: vec(s, 0, c), right: vec(-c, 0, s) };
}
