/**
 * Shared helpers for stage greybox generators (stages 2 and 3; stage 1 predates the kit). Each stage
 * script describes a rail, stops, geometry and markers; the kit turns that into a .glb shaped like a
 * Blender export. All areas run along +z, so markers are placed on world axes from each stop's camera:
 * forward is +z and screen-right is -x.
 */
import { writeFileSync } from 'node:fs';
import { createPath } from '../../src/sim/path.ts';
import { vec, type Vec3 } from '../../src/sim/vec.ts';
import { writeGlb, yawQuat, type NodeData } from '../glb.ts';
import { MeshBuilder } from './builder.ts';

export const EYE = 1.6;
const round = (n: number) => Math.round(n * 100) / 100;

export function stageKit(path: Vec3[]) {
  const rail = createPath(path);
  const markers: NodeData[] = path.map((p, i) => ({
    name: `Path_${String(i).padStart(3, '0')}`,
    translation: [p.x, p.y, p.z],
  }));
  /** Light fittings, drawn unlit by the game so they glow. */
  const lights = new MeshBuilder();

  const cam = (offset: number) => rail.pointAt(offset);

  /** Distance along the rail where the camera reaches a given z (rails always head +z). */
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

  /** World position `ahead` metres in front of a stop and `side` metres to screen-right. */
  function place(offset: number, ahead: number, side: number): { x: number; z: number } {
    const c = cam(offset);
    return { x: c.x - side, z: c.z + ahead };
  }

  function look(name: string, offset: number, distance = 12, height = 1.2): void {
    const c = cam(offset);
    markers.push({ name: `Look_${name}`, translation: [c.x, height, c.z + distance] });
  }

  /** A spawn mark facing the stop's camera. */
  function spawn(name: string, offset: number, ahead: number, side: number, y = 0): Vec3 {
    const c = cam(offset);
    const { x, z } = place(offset, ahead, side);
    markers.push({
      name: `Spawn_${name}`,
      translation: [round(x), y, round(z)],
      rotation: yawQuat(Math.atan2(c.x - x, c.z - z)),
    });
    return vec(x, y, z);
  }

  /** A weapon crate mark (the crate is drawn by the game so it can be shot open). */
  function crate(name: string, offset: number, ahead: number, side: number): void {
    const c = cam(offset);
    const { x, z } = place(offset, ahead, side);
    markers.push({
      name: `Crate_${name}`,
      translation: [round(x), 0, round(z)],
      rotation: yawQuat(Math.atan2(c.x - x, c.z - z)),
    });
  }

  /** A shot-blocking box, drawn too, so what blocks shots is what you see. */
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

  /** A downward-facing light panel. */
  function lamp(x: number, z: number, y: number, len = 2.4, w = 0.4, color = 0xfff6d8): void {
    lights.box(x - w / 2, y - 0.12, z - len / 2, x + w / 2, y, z + len / 2, color, { bottom: true });
  }

  function write(out: string, areas: Record<string, MeshBuilder>, stops: Record<string, number>): void {
    const scene: NodeData[] = [
      ...Object.entries(areas).map(([name, mb]) => ({ name, mesh: mb.mesh })),
      { name: 'Lights', mesh: lights.mesh },
      { name: 'Markers', children: markers },
    ];
    const bytes = writeGlb(scene);
    writeFileSync(out, bytes);
    const tris = [...Object.values(areas), lights].reduce((n, mb) => n + mb.triangles, 0);
    console.log(
      `greybox: wrote ${out}: ${(bytes.byteLength / 1024).toFixed(0)} KB, ${tris} triangles, ${markers.length} markers, rail ${rail.length.toFixed(1)} m`,
    );
    for (const [name, offset] of Object.entries(stops)) {
      const c = cam(offset);
      console.log(
        `  stop ${name.padEnd(10)} offset ${String(offset).padStart(5)}  camera (${c.x.toFixed(2)}, ${c.z.toFixed(2)})`,
      );
    }
  }

  return { rail, markers, lights, cam, offsetAtZ, place, look, spawn, crate, cover, lamp, write };
}

/** A fixed-seed picker for prop variety, so a .glb is identical on every run. */
export function picker(seed: number) {
  let s = seed;
  return <T>(xs: readonly T[]): T => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return xs[s % xs.length]!;
  };
}
