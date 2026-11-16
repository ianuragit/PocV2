import { describe, expect, it } from 'vitest';
import {
  hitZones,
  isHittable,
  rayActor,
  rayBox,
  raySphere,
  rayVerticalCapsule,
  resolveShot,
} from '../../src/sim/shots.ts';
import { normalize, sub, vec, type Vec3 } from '../../src/sim/vec.ts';
import type { Actor } from '../../src/sim/types.ts';
import { tuning } from '../helpers.ts';

const body = tuning().body;
const ray = (origin: Vec3, toward: Vec3) => ({ origin, direction: normalize(sub(toward, origin)) });
const actor = (over: Partial<Actor> = {}): Actor => ({
  id: 1,
  type: 'grunt',
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

describe('resolveShot', () => {
  it('hits the nearest actor', () => {
    const near = actor({ id: 1, position: vec(0, 0, 6) });
    const far = actor({ id: 2, position: vec(0, 0, 12) });
    const hit = resolveShot(ray(eye, vec(0, 0.8, 12)), [far, near], [], body);
    expect(hit.kind === 'actor' && hit.actor.id).toBe(1);
  });

  it('is blocked by cover in front of the target', () => {
    const cover = { name: 'Cover_Wall', min: vec(-1, 0, 4), max: vec(1, 2, 5) };
    const hit = resolveShot(ray(eye, vec(0, 0.8, 10)), [actor()], [cover], body);
    expect(hit).toMatchObject({ kind: 'cover', name: 'Cover_Wall' });
  });

  it('ignores cover behind the target, and resolved actors', () => {
    const cover = { name: 'Cover_Back', min: vec(-1, 0, 14), max: vec(1, 2, 15) };
    expect(resolveShot(ray(eye, vec(0, 0.8, 10)), [actor()], [cover], body).kind).toBe('actor');
    expect(resolveShot(ray(eye, vec(0, 0.8, 10)), [actor({ phase: 'dead' })], [], body).kind).toBe('none');
  });

  it('only living, present actors are hittable', () => {
    expect(
      ['entering', 'waiting', 'aiming', 'standing'].every((p) =>
        isHittable(actor({ phase: p as Actor['phase'] })),
      ),
    ).toBe(true);
    expect(['dead', 'disarmed', 'fled'].some((p) => isHittable(actor({ phase: p as Actor['phase'] })))).toBe(
      false,
    );
  });
});
