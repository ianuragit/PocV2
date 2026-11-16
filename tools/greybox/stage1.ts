/**
 * Greybox for Stage 1, "Metro Station". Stand-in for a Blender file: it writes the same thing a
 * Blender export would, public/assets/stages/stage1.glb, with vertex-coloured geometry and named
 * marker empties (Path_, Look_, Spawn_, Cover_). Run `npm run greybox`, then `npm run markers`.
 *
 * Three areas along one rail: the street entrance and ticket hall, a long platform beside a parked
 * train, and a service tunnel that ends in a maintenance depot. Floor is y = 0 everywhere the
 * player can see enemies; the track beds are pits at y = -1.2.
 */
import { writeFileSync } from 'node:fs';
import { createPath } from '../../src/sim/path.ts';
import { vec, type Vec3 } from '../../src/sim/vec.ts';
import { writeGlb, yawQuat, type NodeData } from '../glb.ts';
import { MeshBuilder } from './builder.ts';

const EYE = 1.6;
const C = {
  // Street and ticket hall
  street: 0x5d6470,
  streetLine: 0xf2f2f2,
  tileA: 0xe9dfc8,
  tileB: 0xd6c7a6,
  hallWall: 0xd8573c,
  hallWallLow: 0xa63e2a,
  column: 0xf0ead8,
  columnBand: 0x2f6fd6,
  roof: 0x6f7480,
  kiosk: 0x1f9d8f,
  kioskTop: 0xf2c230,
  machine: 0xf08a24,
  gate: 0xb9c2cc,
  sign: 0x2f6fd6,
  // Platform
  platform: 0xb8bcc4,
  platformB: 0xa9aeb7,
  edge: 0xffd21f,
  trackBed: 0x3a3530,
  rail: 0x9aa0a8,
  sleeper: 0x5a4632,
  trainBody: 0xe4e8ee,
  trainStripe: 0xd8323c,
  trainWindow: 0x26364d,
  trainDoor: 0xbfc6d0,
  pillar: 0x2a74c9,
  platWall: 0xece6d6,
  platWallBand: 0x2a74c9,
  bench: 0x8b5a2b,
  // Tunnel and depot
  concrete: 0x8b8d90,
  concreteDark: 0x6f7174,
  walkway: 0x9c9a92,
  lamp: 0xffe27a,
  pipe: 0x4d7a3a,
  crate: 0xb8863b,
  crateDark: 0x8a6226,
  barrel: 0x2f62b8,
  hazard: 0xffc21a,
  depotFloor: 0x77797d,
  depotWall: 0x5b4a8f,
};

// ---------- The rail ----------

const PATH: Vec3[] = [
  vec(0, EYE, -8),
  vec(0, EYE, 8),
  vec(0, EYE, 24),
  vec(1.5, EYE, 34),
  vec(5, EYE, 42),
  vec(6, EYE, 52),
  vec(6, EYE, 72),
  vec(6, EYE, 92),
  vec(4.5, EYE, 104),
  vec(0, EYE, 112),
  vec(-2, EYE, 122),
  vec(-2, EYE, 142),
  vec(-2, EYE, 162),
  vec(-2, EYE, 174),
];
const rail = createPath(PATH);

interface StopPose {
  cam: Vec3;
  forward: Vec3;
  right: Vec3;
}
/**
 * Camera position at a stop. Every area runs along +z, so spawns and look targets are placed on
 * world axes from the camera: forward is +z and screen-right is -x (Three.js, looking down +z).
 */
function stopPose(offset: number): StopPose {
  return { cam: rail.pointAt(offset), forward: vec(0, 0, 1), right: vec(-1, 0, 0) };
}

/** Distance along the rail where the camera reaches a given z (the rail always heads +z). */
function offsetAtZ(z: number): number {
  let lo = 0;
  let hi = rail.length;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (rail.pointAt(mid).z < z) lo = mid;
    else hi = mid;
  }
  return Math.round(lo * 10) / 10;
}

/**
 * Where the camera stops, as rail offsets solved from the camera's z.
 * These must match path_offset in public/data/stages/stage1.json (the script prints them).
 */
export const STOPS = {
  entrance: offsetAtZ(2),
  hall: offsetAtZ(14),
  gates: offsetAtZ(28),
  platformA: offsetAtZ(50),
  platformB: offsetAtZ(66),
  platformC: offsetAtZ(84),
  tunnelA: offsetAtZ(122),
  tunnelB: offsetAtZ(140),
  depot: offsetAtZ(166),
  boss: offsetAtZ(173),
};

const markers: NodeData[] = PATH.map((p, i) => ({
  name: `Path_${String(i).padStart(3, '0')}`,
  translation: [p.x, p.y, p.z],
}));

function look(name: string, offset: number, distance = 12, height = 1.2): void {
  const { cam, forward } = stopPose(offset);
  markers.push({
    name: `Look_${name}`,
    translation: [cam.x + forward.x * distance, height, cam.z + forward.z * distance],
  });
}

/** A spawn `ahead` metres in front of the stop and `side` metres to screen-right, facing the camera. */
function spawn(name: string, offset: number, ahead: number, side: number, y = 0): Vec3 {
  const { cam, forward, right } = stopPose(offset);
  const x = cam.x + forward.x * ahead + right.x * side;
  const z = cam.z + forward.z * ahead + right.z * side;
  const yaw = Math.atan2(cam.x - x, cam.z - z);
  markers.push({ name: `Spawn_${name}`, translation: [round(x), y, round(z)], rotation: yawQuat(yaw) });
  return vec(x, y, z);
}

/** A weapon crate marker: the crate itself is drawn by the game, so it can be shot open. */
function crate(name: string, offset: number, ahead: number, side: number): void {
  const { cam, forward, right } = stopPose(offset);
  const x = cam.x + forward.x * ahead + right.x * side;
  const z = cam.z + forward.z * ahead + right.z * side;
  markers.push({
    name: `Crate_${name}`,
    translation: [round(x), 0, round(z)],
    rotation: yawQuat(Math.atan2(cam.x - x, cam.z - z)),
  });
}

/** A shot-blocking box; also drawn, so what blocks shots is what you see. */
function cover(
  name: string,
  mb: MeshBuilder,
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  color: number,
  top?: number,
): void {
  mb.box(x0, y0, z0, x1, y1, z1, color, { top });
  markers.push({
    name: `Cover_${name}`,
    translation: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2],
    scale: [Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, Math.abs(z1 - z0) / 2],
  });
}

const round = (n: number) => Math.round(n * 100) / 100;

// ---------- Area 1: street entrance and ticket hall (z -14 .. 44) ----------

const hall = new MeshBuilder();
// Street outside, open to the sky.
hall.tiles(-14, -16, 14, -2, 0, 2, C.street, 0x555b66);
for (let z = -15; z < -3; z += 3) hall.box(-0.15, 0, z, 0.15, 0.02, z + 1.5, C.streetLine);
// Entrance facade with a wide opening.
hall.box(-12, 0, -2.6, -3.5, 6, -2, C.hallWall);
hall.box(3.5, 0, -2.6, 12, 6, -2, C.hallWall);
hall.box(-3.5, 4.2, -2.6, 3.5, 6, -2, C.hallWall);
hall.box(-3.2, 4.4, -2.7, 3.2, 5.6, -2.6, C.sign);
// Ticket hall floor, walls and roof.
hall.tiles(-12, -2, 12, 44, 0, 2, C.tileA, C.tileB);
hall.box(-12.6, 0, -2, -12, 6, 44, C.hallWall);
hall.box(12, 0, -2, 12.6, 6, 44, C.hallWall);
hall.box(-12.5, 0, -2, -12, 1.2, 44, C.hallWallLow);
hall.box(12, 0, -2, 12.5, 1.2, 44, C.hallWallLow);
hall.ceiling(-12, -2, 12.6, 44, 6, C.roof);
// Columns in two rows, kept clear of the rail and the spawns.
for (const x of [-8, 8]) {
  for (let z = 4; z <= 36; z += 8) {
    hall.box(x - 0.45, 0, z - 0.45, x + 0.45, 6, z + 0.45, C.column);
    hall.box(x - 0.5, 2.6, z - 0.5, x + 0.5, 2.9, z + 0.5, C.columnBand);
  }
}
// Ticket machines along the left wall.
for (let z = 6; z <= 30; z += 3) hall.box(10.6, 0, z, 11.8, 1.9, z + 1.4, C.machine, { top: 0x333333 });
// Newsstand kiosk (cover) at the entrance stop, and a coffee kiosk (cover) in the hall.
{
  const p = stopPose(STOPS.entrance);
  const kx = p.cam.x - 3.2;
  const kz = p.cam.z + 9;
  cover('Newsstand', hall, kx - 1.4, 0, kz - 1, kx + 1.4, 2.2, kz + 1, C.kiosk, C.kioskTop);
  hall.box(kx - 1.6, 2.2, kz - 1.2, kx + 1.6, 2.4, kz + 1.2, C.kioskTop);
}
{
  const p = stopPose(STOPS.hall);
  const kx = p.cam.x + 2.8;
  const kz = p.cam.z + 8;
  cover('CoffeeKiosk', hall, kx - 1.2, 0, kz - 1.2, kx + 1.2, 1.3, kz + 1.2, C.kiosk, C.kioskTop);
}
// Fare gates across the hall, with an opening on the rail side.
for (let x = -11; x <= -2; x += 1.5) hall.box(x, 0, 40, x + 0.25, 1.1, 41.5, C.gate, { top: 0x2c2c2c });
hall.box(-11.5, 1.1, 40.5, -1.75, 1.2, 41, 0x2c2c2c);

look('Entrance', STOPS.entrance);
spawn('NewsstandLeft', STOPS.entrance, 9, 1.0);
spawn('NewsstandRight', STOPS.entrance, 9.5, 6.2);
spawn('Doorway', STOPS.entrance, 14, -3);
spawn('StreetCivilian', STOPS.entrance, 6, -4.2);

look('Hall', STOPS.hall);
spawn('HallLeft', STOPS.hall, 10, 4.5);
spawn('KioskLeft', STOPS.hall, 8.5, -0.6);
spawn('KioskRight', STOPS.hall, 9, -5.8);
spawn('HallBack', STOPS.hall, 15, 1.5);
spawn('MachinesRight', STOPS.hall, 11, -7.5);
spawn('HallCivilian', STOPS.hall, 7, 6);

look('Gates', STOPS.gates);
spawn('GateA', STOPS.gates, 8, 3.5);
spawn('GateB', STOPS.gates, 10, -0.5);
spawn('GateC', STOPS.gates, 9, -4.5);
spawn('GateCivilian', STOPS.gates, 6, 6);

// ---------- Area 2: platform beside a parked train (z 44 .. 110) ----------

const plat = new MeshBuilder();
const PZ0 = 44;
const PZ1 = 104;
plat.tiles(2, PZ0, 13, PZ1, 0, 2, C.platform, C.platformB);
plat.box(2, -0.05, PZ0, 2.5, 0.01, PZ1, C.edge);
plat.box(1.6, -1.2, PZ0, 2, 0, PZ1, C.platWall);
// Track bed and rails.
plat.tiles(-6, PZ0, 2, PZ1, -1.2, 2, C.trackBed, 0x332f2a);
for (let z = PZ0; z < PZ1; z += 1) plat.box(-4.6, -1.2, z, -1.4, -1.1, z + 0.3, C.sleeper);
for (const x of [-3.9, -2.1]) plat.box(x - 0.06, -1.1, PZ0, x + 0.06, -0.95, PZ1, C.rail);
plat.box(-6.6, -1.2, PZ0, -6, 7, PZ1, C.platWall);
// Close the seams where the hall meets the platform hall: end walls beside it and a fascia over
// the step from the 6 m hall roof to the 7 m platform roof.
plat.box(-12.6, 0, PZ0 - 0.4, -6, 7, PZ0, C.platWall);
plat.box(12, 0, PZ0 - 0.4, 13.6, 7, PZ0, C.platWall);
plat.box(-12.6, 6, PZ0 - 0.4, 13.6, 7, PZ0, C.platWall);
// End faces of the track pit, so the drop never shows the sky beneath the floor.
plat.box(-6, -1.2, PZ0 - 0.2, 2, 0, PZ0, C.platWall);
plat.box(-6, -1.2, PZ1, 2, 0, PZ1 + 0.2, C.platWall);
// Walls, roof, pillars and benches on the platform.
plat.box(13, 0, PZ0, 13.6, 7, PZ1, C.platWall);
plat.box(12.9, 2.4, PZ0, 13, 2.8, PZ1, C.platWallBand);
plat.ceiling(-6.6, PZ0, 13.6, PZ1, 7, 0x4d525c);
for (let z = 46; z <= 104; z += 10) {
  plat.box(10.8, 0, z - 0.4, 11.6, 7, z + 0.4, C.pillar);
}
for (let z = 50; z <= 100; z += 10) plat.box(11.9, 0, z, 12.6, 0.5, z + 2.4, C.bench);
// Train: two cars, floor level with the platform, doors facing the platform.
const CAR_LEN = 22;
const doorZs: number[] = [];
for (const z0 of [46, 70]) {
  plat.box(-5, -0.9, z0, -0.4, 0, z0 + CAR_LEN, 0x2a2a2a);
  plat.box(-5, 0, z0, -4.6, 3.2, z0 + CAR_LEN, C.trainBody);
  plat.box(-5, 3.2, z0, -0.4, 3.6, z0 + CAR_LEN, C.trainBody, { top: 0xaab2bc });
  plat.box(-4.6, 0, z0, -0.4, 0.05, z0 + CAR_LEN, 0x3d4350);
  for (const end of [z0, z0 + CAR_LEN - 0.3]) plat.box(-5, 0, end, -0.4, 3.2, end + 0.3, C.trainBody);
  // Platform-side wall: panels between doors, with windows and a stripe.
  const doors = [z0 + 4, z0 + 11, z0 + 18];
  let z = z0;
  for (const dz of doors) {
    plat.box(-0.6, 0, z, -0.4, 3.2, dz - 0.8, C.trainBody);
    plat.box(-0.45, 1.3, z + 0.3, -0.35, 2.4, dz - 1.1, C.trainWindow);
    plat.box(-0.45, 0.8, z, -0.33, 1.05, dz - 0.8, C.trainStripe);
    plat.box(-0.6, 2.3, dz - 0.8, -0.4, 3.2, dz + 0.8, C.trainBody);
    plat.box(-0.62, 0, dz - 0.95, -0.4, 2.3, dz - 0.8, C.trainDoor);
    plat.box(-0.62, 0, dz + 0.8, -0.4, 2.3, dz + 0.95, C.trainDoor);
    doorZs.push(dz);
    z = dz + 0.8;
  }
  plat.box(-0.6, 0, z, -0.4, 3.2, z0 + CAR_LEN, C.trainBody);
  plat.box(-0.45, 0.8, z, -0.33, 1.05, z0 + CAR_LEN, C.trainStripe);
}
// Low platform barrier near the far end (cover).
cover('Barrier', plat, 8.5, 0, 97, 10.2, 1.1, 97.6, C.edge, 0x333333);

/** A spawn standing in a train doorway (just inside the car), nearest to `z`. */
function doorSpawn(name: string, offset: number, z: number): void {
  const dz = doorZs.reduce((a, b) => (Math.abs(b - z) < Math.abs(a - z) ? b : a));
  const { cam } = stopPose(offset);
  const x = -0.75;
  markers.push({
    name: `Spawn_${name}`,
    translation: [x, 0, dz],
    rotation: yawQuat(Math.atan2(cam.x - x, cam.z - dz)),
  });
}

look('PlatformA', STOPS.platformA);
spawn('PlatA1', STOPS.platformA, 9, -2);
spawn('PlatA2', STOPS.platformA, 12, 1.5);
doorSpawn('DoorA', STOPS.platformA, 66);
spawn('PlatACivilian', STOPS.platformA, 7, -4);

look('PlatformB', STOPS.platformB);
spawn('PlatB1', STOPS.platformB, 10, -3.5);
spawn('PlatB2', STOPS.platformB, 13, 0);
doorSpawn('DoorB1', STOPS.platformB, 81);
doorSpawn('DoorB2', STOPS.platformB, 88);
spawn('PlatB3', STOPS.platformB, 16, -1.5);

look('PlatformC', STOPS.platformC);
spawn('PlatC1', STOPS.platformC, 9, 0.5);
spawn('BarrierLeft', STOPS.platformC, 14, -1.8);
spawn('PlatC2', STOPS.platformC, 16, -5.3);
spawn('PlatCCivilian', STOPS.platformC, 6.5, 2.5);

// ---------- Area 3: crossing, service tunnel and depot (z 104 .. 190) ----------

const tun = new MeshBuilder();
// Crossing deck over the track end.
tun.tiles(-6, 104, 13, 118, 0, 2, C.walkway, 0x8f8d86);
tun.box(13, 0, 104, 13.6, 7, 118, C.platWall);
tun.box(-6.6, -1.2, 104, -6, 7, 118, C.platWall);
tun.ceiling(-6.6, 104, 13.6, 118, 7, 0x4d525c);
tun.box(-6.6, 0, 117.6, -4.6, 4.2, 118, C.concrete);
tun.box(4.6, 0, 117.6, 13.6, 7, 118, C.concrete);
tun.box(-4.6, 4.2, 117.6, 4.6, 7, 118, C.concrete);
// Tunnel: walkway on the left of the tracks.
const TZ0 = 118;
const TZ1 = 172;
tun.tiles(-4.6, TZ0, 0.4, TZ1, 0, 1, C.walkway, 0x8f8d86);
tun.box(0.4, -1.2, TZ0, 0.6, 0, TZ1, C.hazard);
tun.box(0.6, -1.2, TZ0 - 0.2, 4.6, 0, TZ0, C.concrete);
tun.box(0.6, -1.2, TZ1, 4.6, 0, TZ1 + 0.2, C.concrete);
tun.tiles(0.6, TZ0, 4.6, TZ1, -1.2, 2, C.trackBed, 0x332f2a);
for (const x of [1.6, 3.4]) tun.box(x - 0.06, -1.1, TZ0, x + 0.06, -0.95, TZ1, C.rail);
tun.box(-5.2, 0, TZ0, -4.6, 4.2, TZ1, C.concrete);
tun.box(4.6, -1.2, TZ0, 5.2, 4.2, TZ1, C.concrete);
tun.ceiling(-5.2, TZ0, 5.2, TZ1, 4.2, C.concreteDark);
for (let z = TZ0 + 4; z < TZ1; z += 8) {
  tun.box(-4.65, 3.2, z, -4.4, 3.5, z + 1.2, C.lamp);
  tun.box(4.4, 3.2, z, 4.65, 3.5, z + 1.2, C.lamp);
  tun.box(-5.2, 0, z - 0.3, -4.4, 4.2, z + 0.3, C.concreteDark);
}
tun.box(-4.6, 2.6, TZ0, -4.3, 2.8, TZ1, C.pipe);
// Crates and a parked maintenance cart in the tunnel (cover).
{
  const p = stopPose(STOPS.tunnelA);
  cover('CrateStack', tun, -4.4, 0, p.cam.z + 8, -3.2, 1.2, p.cam.z + 9.2, C.crate, C.crateDark);
  tun.box(-4.4, 1.2, p.cam.z + 8.1, -3.5, 2.0, p.cam.z + 9, C.crateDark);
}
{
  const p = stopPose(STOPS.tunnelB);
  cover('Cart', tun, 1.6, -0.2, p.cam.z + 10, 3.4, 1.0, p.cam.z + 12.5, C.hazard, 0x333333);
}
// Depot: a wide room at the end.
tun.tiles(-10, TZ1, 10, 192, 0, 2, C.depotFloor, 0x6c6e72);
tun.box(-10.6, 0, TZ1, -10, 6, 192, C.depotWall);
tun.box(10, 0, TZ1, 10.6, 6, 192, C.depotWall);
tun.box(-10.6, 0, 192, 10.6, 6, 192.6, C.depotWall);
tun.box(-10.6, 4.2, TZ1, 10.6, 6, TZ1 + 0.4, C.concrete);
tun.box(-10.6, 0, TZ1, -5.2, 4.2, TZ1 + 0.4, C.concrete);
tun.box(5.2, 0, TZ1, 10.6, 4.2, TZ1 + 0.4, C.concrete);
tun.ceiling(-10.6, TZ1, 10.6, 192.6, 6, C.concreteDark);
for (let x = -8; x <= 8; x += 4) tun.box(x - 1, 2.2, 191.8, x + 1, 4.4, 192, C.hazard);
for (const [x, z] of [
  [-8.5, 176],
  [8.5, 178],
  [-8.5, 186],
] as const) {
  tun.box(x - 0.6, 0, z - 0.6, x + 0.6, 1.4, z + 0.6, C.barrel, { top: 0x1d3f7a });
}
{
  const p = stopPose(STOPS.depot);
  cover(
    'DepotCrates',
    tun,
    p.cam.x + 2.5,
    0,
    p.cam.z + 11,
    p.cam.x + 5,
    1.4,
    p.cam.z + 12.5,
    C.crate,
    C.crateDark,
  );
}

look('TunnelA', STOPS.tunnelA);
spawn('TunA1', STOPS.tunnelA, 10, -0.4);
spawn('CrateLean', STOPS.tunnelA, 8.6, 0.75);
spawn('TunA2', STOPS.tunnelA, 16, 1.5);

look('TunnelB', STOPS.tunnelB);
spawn('TunB1', STOPS.tunnelB, 9, 1.0);
spawn('CartTop', STOPS.tunnelB, 11.25, -4.5, 1.0);
spawn('TunB3', STOPS.tunnelB, 16, -1.4);
spawn('TunB2', STOPS.tunnelB, 15, 1.8);
spawn('TunnelCivilian', STOPS.tunnelB, 6, 1.8);

look('Depot', STOPS.depot, 14);
spawn('DepotLeft', STOPS.depot, 12, 5);
spawn('DepotCentre', STOPS.depot, 16, 0);
spawn('DepotRight', STOPS.depot, 12, -1.2);
spawn('DepotBack', STOPS.depot, 20, 3);
spawn('DepotCratesRight', STOPS.depot, 11.8, -5.8);
spawn('DepotFarRight', STOPS.depot, 17, -8.5);

// Boss: the camera rolls into the depot doorway; the boss moves between three marks.
look('Boss', STOPS.boss, 12);
spawn('BossA', STOPS.boss, 12, 0);
spawn('BossB', STOPS.boss, 12, -4);
spawn('BossC', STOPS.boss, 11, 5);
spawn('BossGuardL', STOPS.boss, 7, 4);
spawn('BossGuardM', STOPS.boss, 9, 2);

// Weapon crates: low boxes off the firing lines (shots at body height pass over them).
crate('Hall', STOPS.hall, 5, 2);
crate('Platform', STOPS.platformA, 7, 2.4);
crate('Tunnel', STOPS.tunnelB, 7, 1.2);

// ---------- Write ----------

const scene: NodeData[] = [
  { name: 'Hall', mesh: hall.mesh },
  { name: 'Platform', mesh: plat.mesh },
  { name: 'Tunnel', mesh: tun.mesh },
  { name: 'Markers', children: markers },
];
const out = 'public/assets/stages/stage1.glb';
const bytes = writeGlb(scene);
writeFileSync(out, bytes);
const tris = hall.triangles + plat.triangles + tun.triangles;
console.log(
  `greybox: wrote ${out}: ${(bytes.byteLength / 1024).toFixed(0)} KB, ${tris} triangles, ${markers.length} markers, rail ${rail.length.toFixed(1)} m`,
);
for (const [name, offset] of Object.entries(STOPS)) {
  const { cam } = stopPose(offset);
  console.log(
    `  stop ${name.padEnd(10)} offset ${String(offset).padStart(3)}  camera (${cam.x.toFixed(2)}, ${cam.z.toFixed(2)})`,
  );
}
