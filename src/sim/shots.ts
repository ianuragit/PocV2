import { add, basis, dot, scale, sub, vec, type Vec3 } from './vec.ts';
import type { Actor, HitZone, Tuning } from './types.ts';
import type { Box } from './stage.ts';

export interface Ray {
  origin: Vec3;
  /** Must be unit length. */
  direction: Vec3;
}

/** Distance along the ray to the first hit on a sphere, or null. */
export function raySphere(ray: Ray, center: Vec3, radius: number): number | null {
  const oc = sub(ray.origin, center);
  const b = dot(oc, ray.direction);
  const c = dot(oc, oc) - radius * radius;
  const disc = b * b - c;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const t = -b - s >= 0 ? -b - s : -b + s;
  return t >= 0 ? t : null;
}

/** Distance to the first hit on a vertical capsule from (x, y0, z) to (x, y1, z), or null. */
export function rayVerticalCapsule(
  ray: Ray,
  base: Vec3,
  y0: number,
  y1: number,
  radius: number,
): number | null {
  let best: number | null = null;
  const consider = (t: number | null) => {
    if (t !== null && (best === null || t < best)) best = t;
  };
  // Cylinder side: solve in the XZ plane.
  const ox = ray.origin.x - base.x;
  const oz = ray.origin.z - base.z;
  const dx = ray.direction.x;
  const dz = ray.direction.z;
  const a = dx * dx + dz * dz;
  if (a > 1e-12) {
    const b = ox * dx + oz * dz;
    const c = ox * ox + oz * oz - radius * radius;
    const disc = b * b - a * c;
    if (disc >= 0) {
      const s = Math.sqrt(disc);
      for (const t of [(-b - s) / a, (-b + s) / a]) {
        const y = ray.origin.y + ray.direction.y * t;
        if (t >= 0 && y >= y0 && y <= y1) consider(t);
      }
    }
  }
  consider(raySphere(ray, vec(base.x, y0, base.z), radius));
  consider(raySphere(ray, vec(base.x, y1, base.z), radius));
  return best;
}

/** Distance to the first hit on an axis-aligned box (slab method), or null. */
export function rayBox(ray: Ray, box: Box): number | null {
  let tMin = 0;
  let tMax = Infinity;
  for (const axis of ['x', 'y', 'z'] as const) {
    const o = ray.origin[axis];
    const d = ray.direction[axis];
    const lo = box.min[axis];
    const hi = box.max[axis];
    if (Math.abs(d) < 1e-12) {
      if (o < lo || o > hi) return null;
    } else {
      let t1 = (lo - o) / d;
      let t2 = (hi - o) / d;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tMin = Math.max(tMin, t1);
      tMax = Math.min(tMax, t2);
      if (tMin > tMax) return null;
    }
  }
  return tMin;
}

/** World-space centres of an actor's hit zones. Exported so the debug overlay can draw them. */
export function hitZones(actor: Pick<Actor, 'position' | 'yaw'>, body: Tuning['body']) {
  const { forward, right } = basis(actor.yaw);
  const [hr, hu, hf] = body.hand_offset;
  return {
    head: { center: add(actor.position, vec(0, body.head_height, 0)), radius: body.head_radius },
    hand: {
      center: add(add(add(actor.position, scale(right, hr)), vec(0, hu, 0)), scale(forward, hf)),
      radius: body.hand_radius,
    },
    body: {
      base: actor.position,
      y0: actor.position.y + body.body_bottom,
      y1: actor.position.y + body.body_top,
      radius: body.body_radius,
    },
  };
}

/** Nearest zone of one actor the ray hits. Gun hand is tested first, so it wins ties. */
export function rayActor(ray: Ray, actor: Actor, body: Tuning['body']): { t: number; zone: HitZone } | null {
  const z = hitZones(actor, body);
  const candidates: { t: number | null; zone: HitZone }[] = [
    { t: raySphere(ray, z.hand.center, z.hand.radius), zone: 'gun_hand' },
    { t: raySphere(ray, z.head.center, z.head.radius), zone: 'head' },
    { t: rayVerticalCapsule(ray, z.body.base, z.body.y0, z.body.y1, z.body.radius), zone: 'body' },
  ];
  let best: { t: number; zone: HitZone } | null = null;
  for (const c of candidates) {
    if (c.t !== null && (best === null || c.t < best.t - 1e-9)) best = { t: c.t, zone: c.zone };
  }
  return best;
}

export type ShotTarget =
  | { kind: 'actor'; actor: Actor; zone: HitZone; t: number }
  | { kind: 'cover'; name: string; t: number }
  | { kind: 'none' };

/** Resolves one shot against every hittable actor and cover box: the nearest thing wins. */
export function resolveShot(
  ray: Ray,
  actors: readonly Actor[],
  covers: readonly Box[],
  body: Tuning['body'],
): ShotTarget {
  let best: ShotTarget = { kind: 'none' };
  let bestT = Infinity;
  for (const actor of actors) {
    if (!isHittable(actor)) continue;
    const hit = rayActor(ray, actor, body);
    if (hit && hit.t < bestT) {
      bestT = hit.t;
      best = { kind: 'actor', actor, zone: hit.zone, t: hit.t };
    }
  }
  for (const box of covers) {
    const t = rayBox(ray, box);
    if (t !== null && t < bestT) {
      bestT = t;
      best = { kind: 'cover', name: box.name, t };
    }
  }
  return best;
}

export function isHittable(actor: Actor): boolean {
  return (
    actor.phase === 'entering' ||
    actor.phase === 'waiting' ||
    actor.phase === 'aiming' ||
    actor.phase === 'standing'
  );
}
