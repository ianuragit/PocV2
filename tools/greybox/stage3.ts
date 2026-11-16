/**
 * Greybox for Stage 3, "Hillside Dam". Stands in for a Blender file (see stage1.ts and kit.ts).
 *
 * A mountain access road between a cliff and a wooded drop, the crest of a dam between the reservoir
 * and a 30 m fall, then the turbine hall, where the boss commands from the control-room balcony.
 */
import { vec } from '../../src/sim/vec.ts';
import { MeshBuilder, prism } from './builder.ts';
import { EYE, picker, stageKit } from './kit.ts';

const C = {
  asphalt: 0x50545b,
  asphaltB: 0x4a4e55,
  line: 0xf2f2f2,
  verge: 0x7a8a4a,
  rocks: [0x8a7a66, 0x7d6f60, 0x9a8b74, 0x6f6455],
  grass: 0x6f8f45,
  grassB: 0x678640,
  trunk: 0x5a3d22,
  pines: [0x2f6b3a, 0x2a5f34, 0x3a7a44],
  rail: 0xc9ccd1,
  concrete: 0xc4c0b6,
  concreteB: 0xb8b4aa,
  dam: 0xa8a49a,
  water: 0x2f78b5,
  waterB: 0x2a6ea8,
  river: 0x3b86c0,
  barrier: 0xe8e4da,
  stripe: 0xd8323c,
  truck: 0xf08a24,
  truckDark: 0x2b2f3a,
  cabinet: 0x5b6b7a,
  sandbag: 0xb5a37a,
  buggy: 0x2f6fd6,
  hallFloor: 0x9aa39c,
  hallFloorB: 0x929b94,
  hallWall: 0xd7d2c3,
  hallTrim: 0x2f6f8f,
  turbine: 0x2f8f8a,
  turbineTop: 0x267670,
  console: 0x3a4250,
  screen: 0x3ddc84,
  catwalk: 0x6c7480,
  crane: 0xf2c230,
};

const kit = stageKit([
  vec(0, EYE, -8),
  vec(0, EYE, 10),
  vec(0.4, EYE, 28),
  vec(1, EYE, 44),
  vec(0, EYE, 60),
  vec(0, EYE, 80),
  vec(0, EYE, 100),
  vec(0, EYE, 120),
  vec(1, EYE, 134),
  vec(2, EYE, 146),
  vec(2, EYE, 164),
  vec(2, EYE, 180),
]);
const { cover, crate, lamp, look, offsetAtZ, spawn } = kit;
const pick = picker(3031);

export const STOPS = {
  roadA: offsetAtZ(4),
  roadB: offsetAtZ(22),
  roadC: offsetAtZ(42),
  crestA: offsetAtZ(74),
  crestB: offsetAtZ(92),
  crestC: offsetAtZ(114),
  hallA: offsetAtZ(142),
  hallB: offsetAtZ(160),
  boss: offsetAtZ(178),
};

function pine(mb: MeshBuilder, x: number, y: number, z: number, h: number): void {
  prism(mb, x, y, z, 0.25, h * 0.3, 5, C.trunk);
  prism(mb, x, y + h * 0.25, z, h * 0.32, h * 0.75, 7, pick(C.pines), { topRadius: 0 });
}

// ---------- Area 1: access road (z -14 .. 62) ----------

const road = new MeshBuilder();
road.tiles(-4.5, -14, 5, 62, 0, 2, C.asphalt, C.asphaltB);
for (let z = -12; z < 60; z += 4) road.box(0.35, 0, z, 0.5, 0.015, z + 2, C.line);
road.box(5, 0, -14, 6.5, 0.5, 62, C.verge);
// The cliff on the left: blocks of rock of varied height, with a ledge.
for (let z = -14; z < 62; z += 4) {
  const h = 4 + ((z * 7 + 140) % 7);
  road.box(6.5, 0, z, 9 + ((z + 20) % 3), h, z + 4, pick(C.rocks));
  road.box(9, 0, z, 14, h + 2, z + 4, pick(C.rocks));
}
{
  const c = kit.cam(STOPS.roadA);
  road.box(4.6, 0, c.z + 10, 6.5, 3, c.z + 16, pick(C.rocks)); // a rock outcrop; its top (3 m) is the ledge
}
// The drop on the right: a guardrail, then the hillside stepping down, with pines.
for (let z = -14; z < 62; z += 2) road.box(-4.8, 0, z, -4.65, 0.75, z + 0.15, C.rail);
road.box(-4.85, 0.55, -14, -4.6, 0.75, 62, C.rail);
road.tiles(-12, -14, -4.5, 62, -1.2, 2, C.grass, C.grassB);
road.box(-4.6, -1.2, -14, -4.5, 0, 62, 0x6b5a45);
road.tiles(-40, -14, -12, 62, -5, 4, C.grass, C.grassB);
road.box(-12.1, -5, -14, -12, -1.2, 62, 0x6b5a45);
for (let z = -10; z < 60; z += 7) {
  pine(road, -7 - ((z * 3 + 60) % 4), -1.2, z, 6 + ((z + 30) % 3));
  pine(road, -16 - ((z * 5 + 90) % 9), -5, z + 3, 8 + ((z + 40) % 4));
  pine(road, -26 - ((z * 7 + 70) % 10), -5, z + 1, 9);
}
// Cover: a concrete barrier, a parked utility truck, a fallen boulder.
{
  const c = kit.cam(STOPS.roadA);
  cover('Barrier', road, c.x + 2, 0, c.z + 9, c.x + 4.4, 1.0, c.z + 9.6, C.barrier, C.barrier);
  road.box(c.x + 2, 0.55, c.z + 8.98, c.x + 4.4, 0.75, c.z + 9.62, C.stripe);
}
{
  const c = kit.cam(STOPS.roadB);
  cover('Truck', road, c.x - 3.85, 0, c.z + 9, c.x - 1.65, 2.2, c.z + 14, C.truck, C.truckDark);
  road.box(c.x - 3.75, 0, c.z + 14, c.x - 1.75, 2.6, c.z + 16, C.truck, { top: C.truckDark });
  road.box(c.x - 3.8, 1.6, c.z + 15.9, c.x - 1.7, 2.4, c.z + 16.05, 0x23324a);
}
{
  const c = kit.cam(STOPS.roadC);
  cover('Boulder', road, c.x + 1.6, 0, c.z + 9, c.x + 3.1, 1.3, c.z + 10.5, pick(C.rocks), pick(C.rocks));
}

look('RoadA', STOPS.roadA);
spawn('BarrierRight', STOPS.roadA, 9.8, -1.5);
spawn('RoadAFar', STOPS.roadA, 14, 2);
spawn('Ledge', STOPS.roadA, 13, -5.6, 3);
spawn('Hiker', STOPS.roadA, 7, 3);

look('RoadB', STOPS.roadB);
spawn('TruckLeft', STOPS.roadB, 10, 1.05);
spawn('RoadBMid', STOPS.roadB, 13, -1.5);
spawn('RoadBVerge', STOPS.roadB, 11, -4.35);
spawn('RoadBFar', STOPS.roadB, 18, 1.5);
crate('Road', STOPS.roadB, 6, -3);

look('RoadC', STOPS.roadC);
spawn('BoulderRight', STOPS.roadC, 9.8, -1.1);
spawn('RoadCL', STOPS.roadC, 13, 3.4);
spawn('RoadCFar', STOPS.roadC, 16, -1);
spawn('Cyclist', STOPS.roadC, 6.5, 3);

// ---------- Area 2: the dam crest (z 62 .. 130) ----------

const dam = new MeshBuilder();
dam.tiles(-3.5, 62, 3.5, 130, 0, 1, C.concrete, C.concreteB);
for (const [x0, x1] of [
  [3.5, 3.9],
  [-3.9, -3.5],
] as const)
  dam.box(x0, 0, 62, x1, 1.1, 130, C.dam, { top: C.concrete });
// The reservoir on the left, the dam face and the valley floor far below on the right.
dam.tiles(3.9, 40, 70, 150, -1, 4, C.water, C.waterB);
dam.box(-7, -30, 62, -3.9, 0, 130, C.dam);
for (let i = 0; i < 6; i++)
  dam.box(-7 - i * 2, -30, 62, -5 - i * 2, -6 - i * 4, 130, i % 2 ? C.dam : C.concreteB);
dam.tiles(-80, 20, -7, 170, -30, 6, C.grass, C.grassB);
dam.box(-80, -29.98, 90, -7, -29.95, 104, C.river);
// Lamp posts along the parapets.
for (let z = 66; z < 130; z += 12) {
  for (const x of [3.7, -3.7]) {
    dam.box(x - 0.07, 1.1, z - 0.07, x + 0.07, 4.4, z + 0.07, 0x3a3f47);
    lamp(x, z, 4.5, 0.5, 0.5);
  }
}
// The gatehouse: two towers astride the crest and a bridge over the walkway.
{
  const c = kit.cam(STOPS.crestB);
  const z0 = c.z + 6;
  for (const [x0, x1] of [
    [3.9, 7.5],
    [-7.5, -3.9],
  ] as const) {
    dam.box(x0, 0, z0, x1, 8, z0 + 8, C.dam, { top: 0x8f8b82 });
    dam.box(x0, 7.6, z0 - 0.1, x1, 8.2, z0 + 8.1, C.concrete);
  }
  // The bridge deck is 4 m up, low enough that someone standing on it is in view.
  dam.box(-3.9, 3.6, z0 + 2.6, 3.9, 4, z0 + 5.4, C.concreteB, { bottom: true });
  dam.box(-3.9, 4, z0 + 2.6, 3.9, 4.35, z0 + 2.75, C.rail);
  dam.box(-3.9, 4, z0 + 5.25, 3.9, 4.35, z0 + 5.4, C.rail);
  cover('Sandbags', dam, 1.6, 0, z0 + 3, 3.4, 1.0, z0 + 3.6, C.sandbag, 0xc4b38a);
}
{
  const c = kit.cam(STOPS.crestA);
  cover('Cabinet', dam, -3.4, 0, c.z + 9, -2.4, 1.4, c.z + 10, C.cabinet, 0x4a5866);
  dam.box(-2.42, 0.8, c.z + 9.2, -2.38, 1.2, c.z + 9.8, C.screen);
}
{
  const c = kit.cam(STOPS.crestC);
  cover('Buggy', dam, -3.3, 0, c.z + 9, -1.5, 1.2, c.z + 11.5, C.buggy, 0x1c4690);
  for (const dz of [9.3, 11.2]) dam.box(-3.4, 0, c.z + dz - 0.3, -1.4, 0.5, c.z + dz + 0.3, 0x1a1a1a);
}

look('CrestA', STOPS.crestA);
spawn('CabinetLeft', STOPS.crestA, 9.5, 1.9);
spawn('CrestAFar', STOPS.crestA, 14, -1.5);
spawn('CrestAMid', STOPS.crestA, 12, 0.5);
crate('Crest', STOPS.crestA, 6, -2.5);

look('CrestB', STOPS.crestB);
spawn('TowerDoorL', STOPS.crestB, 7, -3.1);
spawn('SandbagRight', STOPS.crestB, 9.8, -1.1);
spawn('Bridge', STOPS.crestB, 10, 1, 4);
spawn('CrestBFar', STOPS.crestB, 16, 1.8);
spawn('Engineer', STOPS.crestB, 6, 2.6);

look('CrestC', STOPS.crestC);
spawn('BuggyLeft', STOPS.crestC, 10, 1);
spawn('CrestCL', STOPS.crestC, 12, -2.5);
spawn('HallDoor', STOPS.crestC, 15, -0.5);

// ---------- Area 3: turbine hall (z 130 .. 196) ----------

const hall = new MeshBuilder();
const H0 = 130;
const H1 = 196;
hall.tiles(-13.4, H0, 13.4, H1, 0, 2, C.hallFloor, C.hallFloorB);
for (const x of [-14, 13.4]) hall.box(x, 0, H0, x + 0.6, 12, H1, C.hallWall);
for (const x of [-13.4, 13.3]) hall.box(x, 2.2, H0, x + 0.1, 2.6, H1, C.hallTrim);
hall.box(-14, 0, H1, 14, 12, H1 + 0.6, C.hallWall);
hall.box(-14, 0, H0 - 0.6, -3, 12, H0, C.hallWall);
hall.box(5, 0, H0 - 0.6, 14, 12, H0, C.hallWall);
hall.box(-3, 5, H0 - 0.6, 5, 12, H0, C.hallWall);
hall.ceiling(-14, H0, 14, H1, 12, 0x5b6270);
for (let z = H0 + 4; z < H1; z += 8) for (const x of [-7, 0, 7]) lamp(x, z, 12, 2.4, 0.5);
// Turbine housings along the right-hand wall.
for (const z of [140, 154, 168]) {
  prism(hall, -8, 0, z, 2.6, 2, 10, C.turbine);
  prism(hall, -8, 2, z, 2.6, 1.2, 10, C.turbineTop, { topRadius: 1.4 });
  prism(hall, -8, 3.2, z, 0.8, 0.8, 8, 0xd8323c);
  hall.box(-10.8, 0.9, z - 0.1, -5.2, 1.2, z + 0.1, 0xd8323c);
}
// A catwalk along the left-hand wall, 3.5 m up, and a gantry crane under the roof.
hall.box(10, 3.3, H0, 13.4, 3.5, H1, C.catwalk, { bottom: true });
for (let z = H0; z < H1; z += 2) hall.box(9.95, 3.5, z, 10.05, 4.5, z + 0.05, C.catwalk);
for (let z = H0 + 6; z < H1; z += 12) hall.box(10, 0, z, 10.2, 3.3, z + 0.2, C.catwalk);
for (const x of [-13, 13]) hall.box(x - 0.3, 10, H0, x + 0.3, 10.6, H1, C.crane);
hall.box(-13, 9.6, 176, 13, 10, 177.2, C.crane);
// The control console (cover) and the control-room balcony where the boss stands.
{
  const c = kit.cam(STOPS.hallB);
  cover('Console', hall, 6.5, 0, c.z + 9, 8.5, 1.2, c.z + 10, C.console, 0x2b313b);
  hall.box(6.6, 1.2, c.z + 9.1, 8.4, 1.6, c.z + 9.2, C.screen);
}
hall.box(-8, 2.3, 190, 8, 2.5, 194, C.catwalk, { bottom: true });
hall.box(-8, 2.5, 190, 8, 2.7, 190.1, C.crane);
for (const x of [-7.8, -2, 4, 7.6]) hall.box(x, 0, 190, x + 0.2, 2.3, 190.2, C.catwalk);
hall.box(-8, 2.5, 194, 8, 6.5, 194.3, C.console);
for (let x = -7; x < 7; x += 2.4) hall.box(x, 3.4, 193.9, x + 1.8, 5.4, 194, 0x9fd8ff);

look('HallA', STOPS.hallA);
spawn('HallAFloorL', STOPS.hallA, 9, -4);
spawn('CatwalkA', STOPS.hallA, 13, -9.4, 3.5);
spawn('TurbineGap', STOPS.hallA, 8, 6.2);
spawn('HallAMid', STOPS.hallA, 14, 0);
crate('Hall', STOPS.hallA, 6, 2.4);

look('HallB', STOPS.hallB);
spawn('ConsoleRight', STOPS.hallB, 9.5, -4);
spawn('CatwalkB', STOPS.hallB, 14, -9.5, 3.5);
spawn('TurbineBLeft', STOPS.hallB, 11, 6.6);
spawn('HallBFar', STOPS.hallB, 18, 1);
spawn('Technician', STOPS.hallB, 6, -2);

look('Boss', STOPS.boss, 14, 2.5);
spawn('BossCentre', STOPS.boss, 14, 0, 2.5);
spawn('BossLeft', STOPS.boss, 14, 5, 2.5);
spawn('BossRight', STOPS.boss, 14, -5, 2.5);
spawn('BossGuardL', STOPS.boss, 6, 4);
spawn('BossGuardR', STOPS.boss, 7, -4);

kit.write('public/assets/stages/stage3.glb', { Road: road, Dam: dam, Hall: hall }, STOPS);
