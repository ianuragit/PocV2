import {
  BoxGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshLambertMaterial,
  PlaneGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  EdgesGeometry,
} from 'three';
import type { ResolvedStage } from '../sim/stage';

/** Greybox environment: floor, grid, rail line and cover boxes. Replaced by the stage .glb in M3. */
export function buildStageView(stage: ResolvedStage): Group {
  const root = new Group();
  root.name = 'stage';

  const floor = new Mesh(new PlaneGeometry(200, 200), new MeshLambertMaterial({ color: 0x3a404b }));
  floor.rotation.x = -Math.PI / 2;
  root.add(floor);

  // A 1 m grid gives depth cues without textures.
  const lines: number[] = [];
  for (let i = -40; i <= 80; i++) {
    lines.push(-40, 0.02, i, 40, 0.02, i);
    if (i <= 40) lines.push(i, 0.02, -40, i, 0.02, 80);
  }
  const grid = new BufferGeometry();
  grid.setAttribute('position', new Float32BufferAttribute(lines, 3));
  root.add(new LineSegments(grid, new LineBasicMaterial({ color: 0x4a515e })));

  const coverMat = new MeshLambertMaterial({ color: 0x8a7a5c });
  const edgeMat = new LineBasicMaterial({ color: 0x2b2418 });
  for (const box of stage.covers) {
    const size = { x: box.max.x - box.min.x, y: box.max.y - box.min.y, z: box.max.z - box.min.z };
    const geo = new BoxGeometry(size.x, size.y, size.z);
    const mesh = new Mesh(geo, coverMat);
    mesh.position.set((box.min.x + box.max.x) / 2, (box.min.y + box.max.y) / 2, (box.min.z + box.max.z) / 2);
    mesh.add(new LineSegments(new EdgesGeometry(geo), edgeMat));
    mesh.name = box.name;
    root.add(mesh);
  }
  return root;
}
