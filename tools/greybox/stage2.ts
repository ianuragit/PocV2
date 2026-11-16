/**
 * Greybox for Stage 2, "Studio Backlot". Stands in for a Blender file (see stage1.ts and kit.ts).
 *
 * The camera rides a dolly track through a film studio: a lot street of fake storefronts, Sound
 * Stage 7 with a castle-wall set under lighting rigs, a prop warehouse, and a water-tank set where
 * the boss holds a prop boat. Floor is y = 0 except the water (y = -0.6) and the boat deck.
 */
import { vec } from '../../src/sim/vec.ts';
import { MeshBuilder, prism } from './builder.ts';
import { EYE, picker, stageKit } from './kit.ts';

const C = {
  asphalt: 0x4b4f57,
  asphaltB: 0x45494f,
  kerb: 0xc9c4b6,
  pavement: 0xb5ad9c,
  rail: 0x9aa0a8,
  sleeper: 0x6b4a2c,
  facades: [0xd9a441, 0x6fa8a0, 0xc96a4b, 0x8f7bb5, 0xe0d2b0, 0x5f8f5a],
  window: 0x23324a,
  trim: 0xf2ede0,
  awnings: [0xd8323c, 0x2f6fd6, 0x1f9d8f, 0xf2c230],
  stageFloor: 0x3a3f4a,
  stageFloorB: 0x353943,
  stageWall: 0x2c3340,
  panel: 0x343c4b,
  grid: 0x1c1f26,
  catwalk: 0x5b6270,
  castle: 0x9e9584,
  castleDark: 0x847b6b,
  rock: 0x7d6f60,
  camera: 0x1a1a1a,
  case: 0x2b2f3a,
  caseEdge: 0xc0c4ca,
  cart: 0xf2f2f2,
  cartSeat: 0x2f6fd6,
  shelf: 0x6c7480,
  propBox: [0xb8863b, 0x8a6226, 0x6c7480, 0xa64632, 0x3f6f9f],
  statue: 0xd8c9a3,
  statueDark: 0xb8a77f,
  water: 0x2a7fc4,
  waterB: 0x2574b5,
  dock: 0x8b6a45,
  hull: 0xb83a2e,
  deck: 0xc89a5b,
  mast: 0x6b4a2c,
  sail: 0xf2ede0,
  backdrop: 0x8fc4e8,
};

const kit = stageKit([
  vec(0, EYE, -8),
  vec(0, EYE, 10),
  vec(0, EYE, 30),
  vec(0, EYE, 46),
  vec(2.5, EYE, 56),
  vec(4, EYE, 68),
  vec(4, EYE, 88),
  vec(4, EYE, 106),
  vec(2, EYE, 116),
  vec(0, EYE, 126),
  vec(0, EYE, 146),
  vec(0, EYE, 162),
  vec(0, EYE, 172),
]);
const { cover, crate, lamp, look, offsetAtZ, spawn } = kit;
const pick = picker(2027);

export const STOPS = {
  lotA: offsetAtZ(4),
  lotB: offsetAtZ(20),
  lotC: offsetAtZ(36),
  stageA: offsetAtZ(66),
  stageB: offsetAtZ(84),
  stageC: offsetAtZ(100),
  propsA: offsetAtZ(132),
  propsB: offsetAtZ(150),
  boss: offsetAtZ(170),
};

// ---------- Area 1: lot street (z -12 .. 52) ----------

const lot = new MeshBuilder();
lot.tiles(-7, -14, 7, 52, 0, 2, C.asphalt, C.asphaltB);
for (const side of [-1, 1]) {
  lot.box(side * 7, 0, -14, side * 7.3, 0.15, 52, C.kerb);
  lot.tiles(side > 0 ? 7.3 : -10, -14, side > 0 ? 10 : -7.3, 52, 0.15, 1.35, C.pavement, 0xaaa290);
}
// The dolly track the camera rides.
for (const x of [-0.6, 0.6]) lot.box(x - 0.05, 0, -10, x + 0.05, 0.12, 50, C.rail);
for (let z = -10; z < 50; z += 0.8) lot.box(-0.9, 0, z, 0.9, 0.06, z + 0.2, C.sleeper);
// Storefront facades: flats on both sides, 6 m wide, with windows, a door, an awning and a sign.
for (const side of [-1, 1] as const) {
  const x = side * 10;
  const face = x - side * 0.3;
  for (let z = -12; z < 50; z += 6) {
    const h = 6 + ((Math.abs(z) / 6) % 3);
    const color = pick(C.facades);
    lot.box(Math.min(x, face), 0, z, Math.max(x, face), h, z + 6, color, { top: C.trim });
    const inset = face - side * 0.05;
    for (const wz of [z + 0.8, z + 4.2])
      lot.box(Math.min(face, inset), 1.2, wz, Math.max(face, inset), 2.8, wz + 1.0, C.window);
    lot.box(Math.min(face, inset), 0, z + 2.4, Math.max(face, inset), 2.6, z + 3.6, C.window);
    lot.box(
      Math.min(face, face - side * 0.9),
      3.0,
      z + 0.4,
      Math.max(face, face - side * 0.9),
      3.2,
      z + 5.6,
      pick(C.awnings),
    );
    lot.box(
      Math.min(face, face - side * 0.1),
      h - 1.4,
      z + 1,
      Math.max(face, face - side * 0.1),
      h - 0.6,
      z + 5,
      C.trim,
    );
    lot.box(
      Math.min(face, face - side * 0.12),
      h - 1.2,
      z + 1.4,
      Math.max(face, face - side * 0.12),
      h - 0.8,
      z + 4,
      pick(C.awnings),
    );
  }
}
// Lamp posts on the pavements.
for (let z = -6; z < 50; z += 12) {
  for (const x of [-8.2, 8.2]) {
    lot.box(x - 0.08, 0.15, z - 0.08, x + 0.08, 5, z + 0.08, 0x2b2f3a);
    lamp(x, z, 5.1, 0.6, 0.6);
  }
}
// Cover: equipment cases at the first stop, a studio golf cart at the second, a light stand base at the third.
{
  const c = kit.cam(STOPS.lotA);
  cover('Cases', lot, c.x - 4.2, 0, c.z + 8, c.x - 2.6, 1.1, c.z + 9.2, C.case, C.caseEdge);
}
{
  const c = kit.cam(STOPS.lotB);
  cover('GolfCart', lot, c.x + 2.4, 0, c.z + 9, c.x + 3.8, 1.3, c.z + 11.2, C.cart, C.cartSeat);
  lot.box(c.x + 2.4, 1.3, c.z + 9.2, c.x + 3.8, 1.38, c.z + 10.4, C.cartSeat);
  for (const dz of [9.3, 10.9]) lot.box(c.x + 2.5, 1.38, c.z + dz, c.x + 2.6, 2.1, c.z + dz + 0.1, 0x9aa0a8);
  lot.box(c.x + 2.4, 2.1, c.z + 9.1, c.x + 3.8, 2.2, c.z + 11.1, C.cart);
}
{
  const c = kit.cam(STOPS.lotC);
  cover('Generator', lot, c.x - 5, 0, c.z + 10, c.x - 3.2, 1.2, c.z + 11.4, 0xf2c230, 0x2b2b2b);
}

look('LotA', STOPS.lotA);
spawn('LotCasesLeft', STOPS.lotA, 8.6, 1.9);
spawn('LotDoorL', STOPS.lotA, 12, 8.2);
spawn('LotRoad', STOPS.lotA, 14, -2);
spawn('LotCivilian', STOPS.lotA, 7, -4.5);

look('LotB', STOPS.lotB);
spawn('LotCartLeft', STOPS.lotB, 10, -1.8);
spawn('LotCartBehind', STOPS.lotB, 13, -5.8);
spawn('LotDoorR', STOPS.lotB, 11, -8.2);
spawn('LotAwning', STOPS.lotB, 15, 6);
spawn('LotBCivilian', STOPS.lotB, 6.5, 5);
crate('Lot', STOPS.lotB, 6, -5.5);

look('LotC', STOPS.lotC);
spawn('LotGenRight', STOPS.lotC, 10.6, 2.6);
spawn('LotFarL', STOPS.lotC, 14, 7.5);
spawn('LotFarR', STOPS.lotC, 13, -5);
spawn('LotMid', STOPS.lotC, 11, -0.5);

// ---------- Area 2: Sound Stage 7 (z 52 .. 122) ----------

const studio = new MeshBuilder();
const S0 = 52;
const S1 = 122;
studio.tiles(-16, S0, 16, S1, 0, 2, C.stageFloor, C.stageFloorB);
for (const x of [-16.6, 16]) studio.box(x, 0, S0, x + 0.6, 12, S1, C.stageWall);
studio.box(-16.6, 0, S1, 16.6, 12, S1 + 0.6, C.stageWall);
// The big door: the end wall with an opening for the dolly track.
studio.box(-16.6, 0, S0 - 0.6, -5, 12, S0, C.stageWall);
studio.box(9, 0, S0 - 0.6, 16.6, 12, S0, C.stageWall);
studio.box(-5, 7, S0 - 0.6, 9, 12, S0, C.stageWall);
studio.box(-5.4, 0, S0 - 0.8, -5, 7, S0, 0xf2c230);
studio.box(9, 0, S0 - 0.8, 9.4, 7, S0, 0xf2c230);
studio.ceiling(-16.6, S0, 16.6, S1, 12, C.grid);
// Acoustic panels on the walls, catwalks at 8 m, and lighting rigs hung from the grid.
for (let z = S0 + 1; z < S1 - 1; z += 3) {
  for (const x of [-16, 15.9]) studio.box(x, 1.5, z, x + 0.1, 6.5, z + 2.4, C.panel);
}
for (const [x0, x1] of [
  [-16, -14.6],
  [14.6, 16],
] as const) {
  studio.box(x0, 7.9, S0, x1, 8.05, S1, C.catwalk);
  for (let z = S0; z < S1; z += 2)
    studio.box(x0 + (x0 < 0 ? 1.35 : 0), 8.05, z, x0 + (x0 < 0 ? 1.4 : 0.05), 9.1, z + 0.05, C.catwalk);
}
for (let z = S0 + 6; z < S1; z += 9) {
  studio.box(-14, 10.4, z - 0.05, 14, 10.5, z + 0.05, C.catwalk);
  for (const x of [-10, -4, 4, 10]) lamp(x, z, 10.4, 0.5, 0.5, pick([0xfff6d8, 0xffd9a0, 0xa8d8ff]));
}
// The set: a castle wall flat with crenellations, a painted rock pile and a set balcony.
{
  const c = kit.cam(STOPS.stageB);
  const z = c.z + 12;
  cover('CastleWall', studio, -9, 0, z, -2.2, 3.6, z + 0.6, C.castle, C.castleDark);
  for (let x = -9; x < -2.2; x += 1.2) studio.box(x, 3.6, z, x + 0.6, 4.3, z + 0.6, C.castle);
  studio.box(-9, 0, z + 0.6, -8.6, 3.6, z + 3, 0x5a4a38); // braces seen from the side
  prism(studio, 7.5, 0, z - 1, 1.6, 1.4, 7, C.rock, { topRadius: 0.9 });
  prism(studio, 9.2, 0, z + 0.5, 1.1, 2.2, 6, C.rock, { topRadius: 0.4 });
}
{
  const c = kit.cam(STOPS.stageA);
  cover('CameraDolly', studio, c.x + 2, 0, c.z + 8.5, c.x + 3.4, 1.0, c.z + 10.2, C.case, C.caseEdge);
  studio.box(c.x + 2.4, 1.0, c.z + 9.1, c.x + 3.0, 1.9, c.z + 9.7, C.camera);
  studio.box(c.x + 2.5, 1.55, c.z + 8.6, c.x + 2.9, 1.8, c.z + 9.1, C.camera);
}
{
  const c = kit.cam(STOPS.stageC);
  // A set balcony: enemies stand on it, 2.5 m up.
  studio.box(c.x - 9, 2.3, c.z + 12, c.x - 3, 2.5, c.z + 15, C.castleDark, { bottom: true });
  for (const x of [c.x - 8.8, c.x - 3.4]) studio.box(x, 0, c.z + 14.6, x + 0.2, 2.3, c.z + 14.8, C.castle);
  studio.box(c.x - 9, 2.5, c.z + 15, c.x - 3, 6.5, c.z + 15.4, C.castle);
}
// Film cameras on tripods and director chairs along the walls, off the firing lines.
for (const [x, z] of [
  [-13, 60],
  [13, 74],
  [-13, 92],
  [13, 110],
] as const) {
  prism(studio, x, 0, z, 0.5, 1.4, 3, 0x2b2b2b, { topRadius: 0.05 });
  studio.box(x - 0.3, 1.4, z - 0.4, x + 0.3, 1.9, z + 0.4, C.camera);
  studio.box(x - 1.6, 0, z + 1, x - 1.0, 0.9, z + 1.6, 0x8b5a2b);
}

look('StageA', STOPS.stageA);
spawn('StageDollyLeft', STOPS.stageA, 9.4, -0.9);
spawn('StageFloorL', STOPS.stageA, 12, 6);
spawn('StageFloorR', STOPS.stageA, 13, -7);
spawn('StageCrew', STOPS.stageA, 7, 5);

look('StageB', STOPS.stageB);
spawn('CastleLeft', STOPS.stageB, 11.6, 1.2);
spawn('CastleTop', STOPS.stageB, 12.3, 7.34, 3.6);
spawn('RocksRight', STOPS.stageB, 10, -6.2);
spawn('StageBMid', STOPS.stageB, 15, -1.5);
spawn('StageBCrew', STOPS.stageB, 5.5, 4.5);
crate('Stage', STOPS.stageB, 6.5, 3.2);

look('StageC', STOPS.stageC);
spawn('BalconyL', STOPS.stageC, 13.5, 4.2, 2.5);
spawn('BalconyR', STOPS.stageC, 13.5, 7.5, 2.5);
spawn('StageCFloor', STOPS.stageC, 10, -2.5);
spawn('StageCFar', STOPS.stageC, 16, 1);

// ---------- Area 3: prop warehouse (z 122 .. 168) ----------

const props = new MeshBuilder();
const W0 = 122.6;
const W1 = 168;
props.tiles(-12, W0, 12, W1, 0, 2, 0x8c8f93, 0x84878b);
for (const x of [-12.6, 12]) props.box(x, 0, W0, x + 0.6, 9, W1, 0x9b8f7a);
props.ceiling(-12.6, W0, 12.6, W1, 9, 0x4b4f57);
for (let z = W0 + 3; z < W1; z += 6) for (const x of [-6, 0, 6]) lamp(x, z, 9, 2.4, 0.4);
// Shelving along both walls, loaded with prop boxes.
for (const [x0, x1] of [
  [-11.9, -10.3],
  [10.3, 11.9],
] as const) {
  for (let z = W0 + 2; z < W1 - 3; z += 5) {
    for (const y of [0.05, 1.6, 3.15]) props.box(x0, y, z, x1, y + 0.08, z + 4.2, C.shelf);
    for (const dz of [0, 4.1]) props.box(x0, 0, z + dz, x1, 4.6, z + dz + 0.1, C.shelf);
    for (const y of [0.13, 1.68, 3.23]) {
      props.box(x0 + 0.1, y, z + 0.3, x1 - 0.1, y + 0.9, z + 1.8, pick(C.propBox));
      props.box(x0 + 0.1, y, z + 2.3, x1 - 0.1, y + 0.7, z + 3.8, pick(C.propBox));
    }
  }
}
// A giant prop statue head, lying on its side, and a stack of crates (cover).
{
  const c = kit.cam(STOPS.propsB);
  const hx = c.x + 7.5;
  const hz = c.z + 13;
  props.box(hx - 1.6, 0, hz - 1.4, hx + 1.6, 3.2, hz + 1.4, C.statue);
  props.box(hx - 1.7, 1.6, hz - 1.5, hx + 1.7, 2.1, hz - 1.4, C.statueDark);
  props.box(hx - 1.2, 2.3, hz - 1.5, hx - 0.4, 2.7, hz - 1.4, 0x2b2b2b);
  props.box(hx + 0.4, 2.3, hz - 1.5, hx + 1.2, 2.7, hz - 1.4, 0x2b2b2b);
  props.box(hx - 0.25, 1.2, hz - 1.7, hx + 0.25, 2.0, hz - 1.4, C.statueDark);
  props.box(hx - 1.6, 3.2, hz - 1.4, hx + 1.6, 3.6, hz + 1.4, C.statueDark);
}
{
  const c = kit.cam(STOPS.propsA);
  cover('PropCrates', props, c.x - 4, 0, c.z + 9, c.x - 2.2, 1.4, c.z + 10.6, 0xb8863b, 0x8a6226);
  props.box(c.x - 3.8, 1.4, c.z + 9.3, c.x - 2.6, 2.2, c.z + 10.3, 0x8a6226);
}
props.box(-12.6, 6, W1 - 0.4, 12.6, 9, W1, 0x9b8f7a);
props.box(-12.6, 0, W1 - 0.4, -5, 6, W1, 0x9b8f7a);
props.box(5, 0, W1 - 0.4, 12.6, 6, W1, 0x9b8f7a);

look('PropsA', STOPS.propsA);
spawn('CratesLeft', STOPS.propsA, 9.8, 1.4);
spawn('AisleL', STOPS.propsA, 14, 6.5);
spawn('AisleR', STOPS.propsA, 12, -6.5);
spawn('PropsAMid', STOPS.propsA, 16, -1);
spawn('PropsACivilian', STOPS.propsA, 6.5, -4);

look('PropsB', STOPS.propsB);
spawn('HeadRight', STOPS.propsB, 10, -5);
spawn('PropsBL', STOPS.propsB, 12, 5);
spawn('PropsBFar', STOPS.propsB, 16, 1.5);
spawn('PropsBNear', STOPS.propsB, 8.5, 2.5);

// ---------- Boss: the water-tank set (z 168 .. 200) ----------

const tank = new MeshBuilder();
tank.tiles(-8, 168, 8, 176, 0, 1, C.dock, 0x7e5f3d);
tank.tiles(-14, 176, 14, 202, -0.6, 2, C.water, C.waterB);
for (const x of [-14.4, 14]) tank.box(x, -0.6, 168, x + 0.4, 1, 202, 0x9aa0a8);
// A painted sky backdrop behind the tank.
tank.box(-20, 0, 202, 20, 16, 202.4, C.backdrop);
for (let x = -18; x < 18; x += 5)
  tank.box(x, 3 + ((x + 18) % 4), 201.9, x + 3.4, 4.6 + ((x + 18) % 4), 202, 0xf7f3e8);
// The prop boat: hull, deck at 1.2 m, a mast and a sail.
tank.box(-5, -0.6, 184, 5, 1.2, 192, C.hull, { top: C.deck });
tank.box(-4.6, 1.2, 190, 4.6, 2.4, 192, C.hull);
tank.box(-0.15, 1.2, 188.5, 0.15, 9, 188.8, C.mast);
tank.box(-3.2, 3.5, 188.85, 3.2, 8, 188.95, C.sail);
{
  const c = kit.cam(STOPS.boss);
  cover('Barrels', tank, c.x + 3, 0, c.z + 3.5, c.x + 4.4, 1.1, c.z + 4.9, 0x2f62b8, 0x1d3f7a);
}

look('Boss', STOPS.boss, 16, 2);
spawn('BossDeck', STOPS.boss, 18, 0, 1.2);
spawn('BossBow', STOPS.boss, 17, 3.5, 1.2);
spawn('BossStern', STOPS.boss, 17, -3.5, 1.2);
spawn('BossGuardL', STOPS.boss, 5.5, 5.5);
spawn('BossGuardR', STOPS.boss, 2.5, -6.5);

kit.write('public/assets/stages/stage2.glb', { Lot: lot, Studio: studio, Props: props, Tank: tank }, STOPS);
