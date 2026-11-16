import {
  BackSide,
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  type Material,
} from 'three';
import type { Tuning } from '../sim/index.ts';
import { BRICK, CIVILIAN_OUTLINE, CRATE_COLORS, CRATE_WOOD, OUTFITS, type Outfit } from './style.ts';

/**
 * Blocky, flat-shaded characters built from boxes, sized to the simulation's hit zones
 * (tuning.body): what you see is what you can hit. Local axes: +Z forward, +Y up,
 * and the actor's right hand is on -X (see sim/vec.ts basis).
 */
export interface Character {
  root: Group;
  /** Torso, head and both arms; posed per phase by ActorsView. */
  torso: Group;
  gunArm: Group;
  offArm: Group;
  gun: Mesh | null;
  materials: Material[];
}

export interface CharacterOptions {
  civilian?: boolean;
  /** Holds a riot shield across the body (blocks body shots from the front). */
  shield?: boolean;
  /** Holds a brick in the throwing hand instead of a gun. */
  thrower?: boolean;
}

export function buildCharacter(type: string, opts: CharacterOptions, body: Tuning['body']): Character {
  const civilian = opts.civilian ?? false;
  const outfit: Outfit = OUTFITS[type] ?? OUTFITS.grunt!;
  const materials: Material[] = [];
  const mat = (color: number) => {
    const m = new MeshLambertMaterial({ color, flatShading: true, transparent: true });
    materials.push(m);
    return m;
  };
  const box = (w: number, h: number, d: number, m: Material) => new Mesh(new BoxGeometry(w, h, d), m);

  const jacket = mat(outfit.jacket);
  const trim = mat(outfit.trim);
  const pants = mat(outfit.pants);
  const skin = mat(outfit.skin);
  const bulk = outfit.bulk ?? 1;

  const root = new Group();
  const hip = body.body_bottom + 0.6; // top of the legs
  const shoulder = body.body_top;

  for (const side of [-1, 1]) {
    const leg = box(0.17, hip, 0.2, pants);
    leg.position.set(side * 0.11, hip / 2, 0);
    root.add(leg);
    const shoe = box(0.19, 0.08, 0.28, trim);
    shoe.position.set(side * 0.11, 0.04, 0.04);
    root.add(shoe);
  }

  const torso = new Group();
  root.add(torso);
  const chestH = shoulder - hip + 0.06;
  const chest = box(0.48 * bulk, chestH, 0.28 * bulk, jacket);
  chest.position.y = hip + chestH / 2 - 0.03;
  torso.add(chest);
  const belt = box(0.5 * bulk, 0.07, 0.3 * bulk, trim);
  belt.position.y = hip + 0.02;
  torso.add(belt);
  const stripe = box(0.07, chestH * 0.9, 0.29 * bulk + 0.01, trim);
  stripe.position.set(0.1, chest.position.y, 0);
  torso.add(stripe);

  const head = box(0.24, 0.27, 0.25, skin);
  head.position.y = body.head_height;
  torso.add(head);
  const neck = box(0.12, 0.08, 0.12, skin);
  neck.position.y = shoulder + 0.03;
  torso.add(neck);
  if (outfit.hat) {
    const hm = mat(outfit.hat.color);
    if (outfit.hat.kind === 'beanie') {
      const h = box(0.26, 0.1, 0.27, hm);
      h.position.y = body.head_height + 0.15;
      torso.add(h);
    } else if (outfit.hat.kind === 'cap') {
      const h = box(0.26, 0.08, 0.26, hm);
      h.position.y = body.head_height + 0.15;
      const brim = box(0.24, 0.03, 0.14, hm);
      brim.position.set(0, body.head_height + 0.12, 0.18);
      torso.add(h, brim);
    } else {
      const h = box(0.3, 0.16, 0.31, hm);
      h.position.y = body.head_height + 0.1;
      torso.add(h);
    }
  }

  // Gun arm: shoulder to the simulation's gun-hand point.
  const [hr, hu, hf] = body.hand_offset;
  const shoulderR = { x: -0.29 * bulk, y: shoulder - 0.05, z: 0 };
  const handR = civilian ? { x: -0.3, y: shoulder + 0.45, z: 0.05 } : { x: -hr, y: hu, z: hf };
  const gunArm = limb(shoulderR, handR, jacket, skin);
  torso.add(gunArm);
  let gun: Mesh | null = null;
  if (opts.thrower) {
    gun = box(0.22, 0.12, 0.12, mat(BRICK));
    gun.position.set(-hr, hu + 0.1, hf);
    torso.add(gun);
  } else if (!civilian) {
    gun = box(0.07, 0.12, 0.26, mat(0x1a1a1a));
    gun.position.set(-hr, hu + 0.05, hf + 0.08);
    torso.add(gun);
  }
  if (opts.shield) {
    // A riot shield across the front of the body, held in the off hand, with a viewing slot.
    const board = box(0.62, 0.95, 0.05, mat(0x8fa3b8));
    board.position.set(0.04, body.body_bottom + 0.62, 0.32);
    const slot = box(0.4, 0.07, 0.06, mat(0x22324a));
    slot.position.set(0.04, body.body_bottom + 0.98, 0.33);
    torso.add(board, slot);
  }
  if (outfit.coat) {
    const coat = box(0.5 * bulk, 0.55, 0.3 * bulk, mat(outfit.coat));
    coat.position.y = hip - 0.2;
    root.add(coat);
  }

  // Off arm: hanging, or raised for civilians (hands up reads as "don't shoot").
  const shoulderL = { x: 0.29 * bulk, y: shoulder - 0.05, z: 0 };
  const handL = civilian
    ? { x: 0.3, y: shoulder + 0.45, z: 0.05 }
    : { x: 0.33 * bulk, y: hip + 0.05, z: 0.06 };
  const offArm = limb(shoulderL, handL, jacket, skin);
  torso.add(offArm);

  if (civilian) {
    // A bright outline: back faces of a slightly larger copy of every part.
    const outline = new MeshBasicMaterial({ color: CIVILIAN_OUTLINE, side: BackSide, transparent: true });
    materials.push(outline);
    const parts: Mesh[] = [];
    root.traverse((o) => {
      if (o instanceof Mesh) parts.push(o);
    });
    for (const part of parts) {
      const shell = new Mesh(part.geometry, outline);
      shell.scale.setScalar(1.14);
      part.add(shell);
    }
  }
  return { root, torso, gunArm, offArm, gun, materials };
}

/** A sleeve and a hand from one point to another, as a group rotated to point at the hand. */
function limb(
  from: { x: number; y: number; z: number },
  to: { x: number; y: number; z: number },
  sleeve: Material,
  hand: Material,
): Group {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const len = Math.hypot(dx, dy, dz);
  const g = new Group();
  g.position.set(from.x, from.y, from.z);
  g.rotation.order = 'YXZ';
  g.rotation.y = Math.atan2(dx, dz);
  g.rotation.x = -Math.asin(dy / len);
  const arm = new Mesh(new BoxGeometry(0.13, 0.13, len - 0.08), sleeve);
  arm.position.z = (len - 0.08) / 2;
  const fist = new Mesh(new BoxGeometry(0.11, 0.11, 0.11), hand);
  fist.position.z = len - 0.03;
  g.add(arm, fist);
  return g;
}

/** A wooden crate with a coloured band for the weapon inside; matches tuning.crate half extents. */
export function buildCrate(
  weapon: string,
  half: [number, number, number],
): { root: Group; materials: Material[] } {
  const materials: Material[] = [];
  const mat = (color: number) => {
    const m = new MeshLambertMaterial({ color, flatShading: true, transparent: true });
    materials.push(m);
    return m;
  };
  const [hx, hy, hz] = half;
  const root = new Group();
  const wood = new Mesh(new BoxGeometry(hx * 2, hy * 2, hz * 2), mat(CRATE_WOOD.side));
  wood.position.y = hy;
  const band = new Mesh(
    new BoxGeometry(hx * 2 + 0.02, hy * 0.5, hz * 2 + 0.02),
    mat(CRATE_COLORS[weapon] ?? 0xffffff),
  );
  band.position.y = hy;
  const edgeMat = mat(CRATE_WOOD.edge);
  root.add(wood, band);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const post = new Mesh(new BoxGeometry(0.06, hy * 2 + 0.02, 0.06), edgeMat);
      post.position.set(sx * (hx - 0.02), hy, sz * (hz - 0.02));
      root.add(post);
    }
  }
  return { root, materials };
}

/** A thrown brick. */
export function buildProjectile(): { root: Group; materials: Material[] } {
  const m = new MeshLambertMaterial({ color: BRICK, flatShading: true, transparent: true });
  const root = new Group();
  root.add(new Mesh(new BoxGeometry(0.3, 0.16, 0.16), m));
  return { root, materials: [m] };
}
