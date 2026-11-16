import {
  BackSide,
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  EdgesGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  SphereGeometry,
  Color,
} from 'three';
import type { ResolvedStage } from '../sim/stage.ts';
import { PALETTE, SKY } from './style.ts';

const TILE = 2;
const WALL_GAP = 4; // metres between the play area and the side walls
const WALL_HEIGHT = 5;

/**
 * The stage's surroundings. A stage with an environment .glb uses it under the sky dome. A procedural
 * stage (the firing range) gets set dressing in the arcade style: checker floor, side walls with a
 * stripe, columns, benches and bins, all outside the play area so they never block a shot.
 */
export function buildStageView(
  stage: ResolvedStage,
  spawnPoints: readonly { x: number; z: number }[],
  environment: Group | null = null,
): Group {
  const root = new Group();
  root.name = 'stage';
  if (environment) {
    // A modelled stage brings its own floor, walls and cover; add only the sky.
    root.add(skyDome(), environment);
    return root;
  }

  const pts = [...stage.path.points, ...spawnPoints, ...stage.covers.flatMap((c) => [c.min, c.max])];
  const minX = Math.min(...pts.map((p) => p.x)) - WALL_GAP;
  const maxX = Math.max(...pts.map((p) => p.x)) + WALL_GAP;
  const minZ = Math.min(...pts.map((p) => p.z)) - 10;
  const maxZ = Math.max(...pts.map((p) => p.z)) + 14;

  root.add(skyDome());
  root.add(checkerFloor(minX - 20, maxX + 20, minZ - 20, maxZ + 20));

  const lambert = (color: number) => new MeshLambertMaterial({ color, flatShading: true });
  const wallMats = [lambert(PALETTE.wall), lambert(PALETTE.wallDark)];
  const stripeMat = lambert(PALETTE.stripe);
  const columnMat = lambert(PALETTE.column);
  const bandMat = lambert(PALETTE.columnBand);
  const benchMat = lambert(PALETTE.bench);
  const binMat = lambert(PALETTE.bin);

  const panel = new BoxGeometry(0.4, WALL_HEIGHT, 4);
  const stripe = new BoxGeometry(0.44, 0.35, 4);
  const columnGeo = new BoxGeometry(0.8, WALL_HEIGHT, 0.8);
  const bandGeo = new BoxGeometry(0.84, 0.3, 0.84);
  const seat = new BoxGeometry(0.6, 0.12, 2.2);
  const leg = new BoxGeometry(0.5, 0.4, 0.12);
  const binGeo = new CylinderGeometry(0.28, 0.24, 0.8, 6);

  for (const [x, inward] of [
    [minX, 1],
    [maxX, -1],
  ] as const) {
    for (let z = minZ, i = 0; z < maxZ; z += 4, i++) {
      const p = new Mesh(panel, wallMats[i % 2]!);
      p.position.set(x, WALL_HEIGHT / 2, z + 2);
      root.add(p);
      const s = new Mesh(stripe, stripeMat);
      s.position.set(x, 1.3, z + 2);
      root.add(s);
      if (i % 2 === 0) {
        const c = new Mesh(columnGeo, columnMat);
        c.position.set(x + inward * 0.6, WALL_HEIGHT / 2, z);
        root.add(c);
        for (const y of [0.4, WALL_HEIGHT - 0.6]) {
          const b = new Mesh(bandGeo, bandMat);
          b.position.set(c.position.x, y, z);
          root.add(b);
        }
      } else if (i % 4 === 1) {
        const bench = new Group();
        const top = new Mesh(seat, benchMat);
        top.position.y = 0.46;
        bench.add(top);
        for (const dz of [-0.85, 0.85]) {
          const l = new Mesh(leg, binMat);
          l.position.set(0, 0.2, dz);
          bench.add(l);
        }
        bench.position.set(x + inward * 0.9, 0, z + 2);
        root.add(bench);
      } else {
        const bin = new Mesh(binGeo, binMat);
        bin.position.set(x + inward * 0.8, 0.4, z + 2);
        root.add(bin);
      }
    }
  }

  // Cover reads as chunky crates with dark edges.
  const crateMat = lambert(PALETTE.crate);
  const edgeMat = new LineBasicMaterial({ color: PALETTE.crateEdge });
  for (const box of stage.covers) {
    const geo = new BoxGeometry(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z);
    const mesh = new Mesh(geo, crateMat);
    mesh.position.set((box.min.x + box.max.x) / 2, (box.min.y + box.max.y) / 2, (box.min.z + box.max.z) / 2);
    mesh.add(new LineSegments(new EdgesGeometry(geo), edgeMat));
    mesh.name = box.name;
    root.add(mesh);
  }
  return root;
}

function skyDome(): Mesh {
  const geo = new SphereGeometry(150, 16, 12);
  const top = new Color(SKY.top);
  const horizon = new Color(SKY.horizon);
  const pos = geo.getAttribute('position');
  const colors: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const t = Math.max(0, pos.getY(i) / 150);
    const c = horizon.clone().lerp(top, Math.pow(t, 0.6));
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new Float32BufferAttribute(colors, 3));
  const dome = new Mesh(
    geo,
    new MeshBasicMaterial({ vertexColors: true, side: BackSide, fog: false, depthWrite: false }),
  );
  dome.renderOrder = -1;
  return dome;
}

function checkerFloor(x0: number, x1: number, z0: number, z1: number): Mesh {
  const positions: number[] = [];
  const colors: number[] = [];
  const a = new Color(PALETTE.floorA);
  const b = new Color(PALETTE.floorB);
  const sx = Math.floor(x0 / TILE) * TILE;
  const sz = Math.floor(z0 / TILE) * TILE;
  for (let x = sx; x < x1; x += TILE) {
    for (let z = sz; z < z1; z += TILE) {
      const c = (Math.round(x / TILE) + Math.round(z / TILE)) % 2 === 0 ? a : b;
      // Two triangles, counter-clockwise seen from above.
      positions.push(
        x,
        0,
        z,
        x,
        0,
        z + TILE,
        x + TILE,
        0,
        z,
        x + TILE,
        0,
        z,
        x,
        0,
        z + TILE,
        x + TILE,
        0,
        z + TILE,
      );
      for (let i = 0; i < 6; i++) colors.push(c.r, c.g, c.b);
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return new Mesh(geo, new MeshLambertMaterial({ vertexColors: true }));
}
