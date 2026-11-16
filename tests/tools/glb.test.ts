import { describe, expect, it } from 'vitest';
import { decompose, readGlbJson, worldNodes, writeGlb, yawQuat } from '../../tools/glb.ts';
import { extractMarkers } from '../../tools/extract-markers.ts';
import { MeshBuilder, linear } from '../../tools/greybox/builder.ts';

describe('glb writer and reader', () => {
  it('round-trips names, meshes and world transforms through nested parents', () => {
    const mb = new MeshBuilder();
    mb.box(0, 0, 0, 1, 1, 1, 0xff0000);
    const bytes = writeGlb([
      { name: 'Geo', mesh: mb.mesh },
      {
        name: 'Markers',
        translation: [10, 0, 0],
        rotation: yawQuat(Math.PI / 2),
        children: [{ name: 'Spawn_A', translation: [0, 0, 2], rotation: yawQuat(Math.PI / 2) }],
      },
    ]);
    expect(new DataView(bytes.buffer).getUint32(0, true)).toBe(0x46546c67);
    expect(bytes.byteLength % 4).toBe(0);
    const json = readGlbJson(bytes);
    expect(json.nodes?.map((n) => n.name)).toEqual(['Geo', 'Markers', 'Spawn_A']);

    const nodes = worldNodes(bytes);
    expect(nodes.find((n) => n.name === 'Geo')!.hasMesh).toBe(true);
    const spawn = decompose(nodes.find((n) => n.name === 'Spawn_A')!.matrix);
    // Parent turns 90 degrees, so local +z 2 becomes world +x 2; headings add up to 180 degrees.
    expect(spawn.position[0]).toBeCloseTo(12);
    expect(spawn.position[2]).toBeCloseTo(0);
    expect(Math.abs(spawn.yaw)).toBeCloseTo(Math.PI);
  });

  it('rejects files that are not glb', () => {
    expect(() => readGlbJson(new Uint8Array(32))).toThrow(/not a .glb/);
  });

  it('builds closed boxes with outward normals and linear colours', () => {
    const mb = new MeshBuilder();
    mb.box(0, 0, 0, 2, 1, 1, 0xffffff, { bottom: true });
    expect(mb.triangles).toBe(12);
    mb.tiles(0, 0, 4, 2, 0, 1, 0, 0xffffff);
    expect(mb.triangles).toBe(12 + 16);
    mb.ceiling(0, 0, 1, 1, 3, 0);
    expect(mb.mesh.normals.slice(-3)).toEqual([0, -1, 0]);
    expect(linear(0xffffff)).toEqual([1, 1, 1]);
    expect(linear(0x000000)).toEqual([0, 0, 0]);
    expect(linear(0x808080)[0]).toBeCloseTo(0.2158, 3);
  });
});

describe('extractMarkers', () => {
  it('keeps only marker empties, with heading and cover half extents', () => {
    const mb = new MeshBuilder();
    mb.box(0, 0, 0, 1, 1, 1, 0);
    const bytes = writeGlb([
      { name: 'Spawn_Mesh', mesh: mb.mesh },
      { name: 'Prop', translation: [1, 2, 3] },
      { name: 'Path_000', translation: [0, 1.6, 0] },
      { name: 'Path_010', translation: [0, 1.6, 10] },
      { name: 'Path_002', translation: [0, 1.6, 5] },
      { name: 'Spawn_B', translation: [1.23456, 0, 7], rotation: yawQuat(-Math.PI / 2) },
      { name: 'Cover_Box', translation: [0, 0.5, 4], scale: [1, 0.5, 0.25] },
    ]);
    const m = extractMarkers(bytes) as Record<
      string,
      { position: number[]; rotation: number[]; scale?: number[] }
    >;
    expect(Object.keys(m)).toEqual(['Cover_Box', 'Path_000', 'Path_002', 'Path_010', 'Spawn_B']);
    expect(m.Spawn_B!.position).toEqual([1.2346, 0, 7]);
    expect(m.Spawn_B!.rotation[1]).toBeCloseTo(-Math.PI / 2, 4);
    expect(m.Spawn_B!.scale).toBeUndefined();
    expect(m.Cover_Box!.scale).toEqual([1, 0.5, 0.25]);
  });

  it('fails on duplicate marker names', () => {
    const bytes = writeGlb([
      { name: 'Spawn_A', translation: [0, 0, 0] },
      { name: 'Spawn_A', translation: [1, 0, 0] },
    ]);
    expect(() => extractMarkers(bytes)).toThrow(/duplicate marker "Spawn_A"/);
  });
});
