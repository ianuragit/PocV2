import { describe, expect, it } from 'vitest';
import {
  hitZones,
  isHittable,
  rayActor,
  rayBox,
  raySphere,
  rayVerticalCapsule,
  traceRay,
  crateBox,
  pelletDirections,
} from '../../src/sim/shots.ts';
import { dot, length, normalize, sub, vec, type Vec3 } from '../../src/sim/vec.ts';
import type { Actor } from '../../src/sim/types.ts';
import { tuning } from '../helpers.ts';

const body = tuning().body;
const ray = (origin: Vec3, toward: Vec3) => ({ origin, direction: normalize(sub(toward, origin)) });
const actor = (over: Partial<Actor> = {}): Actor => ({
  id: 1,
  type: 'grunt',
  role: 'enemy',
  civilian: false,
  position: vec(0, 0, 10),
  yaw: Math.PI,
  phase: 'aiming',
  timer: 0,
  hitsLeft: 1,
  aimFrames: 120,
  ringFrames: 120,
  ringElapsed: 0,
  queuedAt: 0,
  shots: 0,
  ...over,
});
const eye = vec(0, 1.6, 0);

describe('ray primitives', () => {
  it('sphere: hit, miss, behind and from inside', () => {
    expect(raySphere(ray(vec(0, 0, 0), vec(0, 0, 1)), vec(0, 0, 5), 1)).toBeCloseTo(4);
    expect(raySphere(ray(vec(0, 0, 0), vec(0, 0, 1)), vec(3, 0, 5), 1)).toBeNull();
    expect(raySphere(ray(vec(0, 0, 0), vec(0, 0, -1)), vec(0, 0, 5), 1)).toBeNull();
    expect(raySphere(ray(vec(0, 0, 5), vec(0, 0, 6)), vec(0, 0, 5), 1)).toBeCloseTo(1);
  });

  it('vertical capsule: side, end cap, above and straight down', () => {
    const base = vec(0, 0, 5);
    expect(rayVerticalCapsule(ray(vec(0, 1, 0), vec(0, 1, 1)), base, 0.5, 1.5, 0.5)).toBeCloseTo(4.5);
    expect(rayVerticalCapsule(ray(vec(0, 1.9, 0), vec(0, 1.9, 1)), base, 0.5, 1.5, 0.5)).not.toBeNull();
    expect(rayVerticalCapsule(ray(vec(0, 3, 0), vec(0, 3, 1)), base, 0.5, 1.5, 0.5)).toBeNull();
    expect(rayVerticalCapsule(ray(vec(0, 5, 5), vec(0, 0, 5)), base, 0.5, 1.5, 0.5)).toBeCloseTo(3);
  });

  it('box: hit, miss, parallel outside and from inside', () => {
    const box = { name: 'b', min: vec(-1, 0, 4), max: vec(1, 2, 6) };
    expect(rayBox(ray(vec(0, 1, 0), vec(0, 1, 1)), box)).toBeCloseTo(4);
    expect(rayBox(ray(vec(0, 1, 0), vec(5, 1, 1)), box)).toBeNull();
    expect(rayBox(ray(vec(3, 1, 0), vec(3, 1, 1)), box)).toBeNull();
    expect(rayBox(ray(vec(0, 1, 5), vec(0, 1, 6)), box)).toBe(0);
  });
});

describe('hit zones', () => {
  it('places the gun hand on the actor right side, forward of the body', () => {
    const z = hitZones(actor(), body);
    // Facing the camera (yaw pi, toward -Z): its right hand is on +X, the viewer's left.
    expect(z.hand.center.x).toBeCloseTo(0.35);
    expect(z.hand.center.z).toBeCloseTo(9.7);
    expect(z.head.center).toEqual(vec(0, 1.62, 10));
  });

  it('tells head, body and gun hand apart', () => {
    const a = actor();
    const z = hitZones(a, body);
    expect(rayActor(ray(eye, z.head.center), a, body)?.zone).toBe('head');
    expect(rayActor(ray(eye, vec(0, 0.8, 10)), a, body)?.zone).toBe('body');
    expect(rayActor(ray(eye, z.hand.center), a, body)?.zone).toBe('gun_hand');
    expect(rayActor(ray(eye, vec(2, 1, 10)), a, body)).toBeNull();
  });
});

const t = tuning();

describe('traceRay', () => {
  it('hits the nearest actor', () => {
    const near = actor({ id: 1, position: vec(0, 0, 6) });
    const far = actor({ id: 2, position: vec(0, 0, 12) });
    const [hit] = traceRay(ray(eye, vec(0, 0.8, 12)), [far, near], [], t);
    expect(hit?.kind === 'actor' && hit.actor.id).toBe(1);
  });

  it('is blocked by cover in front of the target', () => {
    const cover = { name: 'Cover_Wall', min: vec(-1, 0, 4), max: vec(1, 2, 5) };
    expect(traceRay(ray(eye, vec(0, 0.8, 10)), [actor()], [cover], t)).toEqual([
      expect.objectContaining({ kind: 'cover', name: 'Cover_Wall' }),
    ]);
  });

  it('ignores cover behind the target, and resolved actors', () => {
    const cover = { name: 'Cover_Back', min: vec(-1, 0, 14), max: vec(1, 2, 15) };
    expect(traceRay(ray(eye, vec(0, 0.8, 10)), [actor()], [cover], t)[0]?.kind).toBe('actor');
    expect(traceRay(ray(eye, vec(0, 0.8, 10)), [actor({ phase: 'dead' })], [], t)).toEqual([]);
  });

  it('pierces cover and every actor on the line when asked', () => {
    const cover = { name: 'Cover_Wall', min: vec(-1, 0, 4), max: vec(1, 2, 5) };
    const a = actor({ id: 1, position: vec(0, 0, 8) });
    const b = actor({ id: 2, position: vec(0, 0, 12) });
    const hits = traceRay(ray(eye, vec(0, 0.8, 12)), [b, a], [cover], t, true);
    expect(hits.map((h) => (h.kind === 'actor' ? h.actor.id : h.kind))).toEqual([1, 2]);
  });

  it('a shield blocks body shots from the front but not from behind, and the magnum pierces it', () => {
    const s = actor({ type: 'shield' });
    expect(traceRay(ray(eye, vec(0, 0.8, 10)), [s], [], t)[0]?.kind).toBe('shield');
    expect(traceRay(ray(eye, hitZones(s, t.body).head.center), [s], [], t)[0]).toMatchObject({
      zone: 'head',
    });
    const behind = actor({ type: 'shield', yaw: 0 });
    expect(traceRay(ray(eye, vec(0, 0.8, 10)), [behind], [], t)[0]).toMatchObject({
      kind: 'actor',
      zone: 'body',
    });
    expect(traceRay(ray(eye, vec(0, 0.8, 10)), [s], [], t, true)[0]).toMatchObject({
      kind: 'actor',
      zone: 'body',
    });
  });

  it('hits crates as boxes and thrown objects as spheres', () => {
    const crate = actor({ role: 'crate', type: 'crate', phase: 'standing', position: vec(0, 0, 6) });
    expect(crateBox(crate, t).max.y).toBeCloseTo(0.8);
    expect(traceRay(ray(eye, vec(0, 0.4, 6)), [crate], [], t)[0]).toMatchObject({
      kind: 'actor',
      zone: 'body',
    });
    const p = actor({ role: 'projectile', type: 'projectile', phase: 'flying', position: vec(0, 1.6, 5) });
    expect(traceRay(ray(eye, vec(0, 1.6, 5)), [p], [], t)[0]).toMatchObject({ zone: 'thrown' });
    expect(traceRay(ray(eye, vec(1, 1.6, 5)), [p], [], t)).toEqual([]);
  });

  it('only present actors are hittable', () => {
    const live = ['entering', 'waiting', 'aiming', 'standing', 'flying'] as const;
    const gone = ['dead', 'disarmed', 'fled', 'opened', 'moving'] as const;
    expect(live.every((p) => isHittable(actor({ phase: p })))).toBe(true);
    expect(gone.some((p) => isHittable(actor({ phase: p })))).toBe(false);
  });
});

describe('pelletDirections', () => {
  it('is the aim alone for a single pellet', () => {
    expect(pelletDirections(vec(0, 0, 2), 1, 0.1)).toEqual([vec(0, 0, 1)]);
  });

  it('puts one pellet on the aim and the rest evenly on a cone of the given half-angle', () => {
    const dirs = pelletDirections(vec(0, 0, 1), 7, 0.05);
    expect(dirs).toHaveLength(7);
    expect(dirs[0]).toEqual(vec(0, 0, 1));
    for (const d of dirs.slice(1)) {
      expect(length(d)).toBeCloseTo(1);
      expect(Math.acos(dot(d, vec(0, 0, 1)))).toBeCloseTo(0.05, 4);
    }
    // Also works aiming straight up (the helper axis switches).
    expect(pelletDirections(vec(0, 1, 0), 3, 0.1)).toHaveLength(3);
  });
});
