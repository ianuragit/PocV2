/**
 * Minimal glTF 2.0 binary (.glb) writing and reading for the build tools: no dependencies.
 * Writes flat-shaded, vertex-coloured triangle meshes and named empties; reads node names and
 * world transforms (including parent chains, as Blender exports them).
 */

export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number];

export interface MeshData {
  /** Non-indexed triangles: x, y, z per vertex. */
  positions: number[];
  /** One normal per vertex. */
  normals: number[];
  /** RGB per vertex, 0..1. */
  colors: number[];
}

export interface NodeData {
  name: string;
  translation?: Vec3;
  rotation?: Quat;
  scale?: Vec3;
  mesh?: MeshData;
  children?: NodeData[];
}

const GLB_MAGIC = 0x46546c67; // "glTF"
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;
const FLOAT = 5126;
const UNSIGNED_BYTE = 5121;
const ARRAY_BUFFER = 34962;

const pad4 = (n: number) => (n + 3) & ~3;

export function writeGlb(roots: NodeData[]): Uint8Array {
  const json = {
    asset: { version: '2.0', generator: 'real-cop-2 tools/glb.ts' },
    scene: 0,
    scenes: [{ nodes: [] as number[] }],
    nodes: [] as Record<string, unknown>[],
    meshes: [] as Record<string, unknown>[],
    materials: [
      {
        name: 'VertexColor',
        pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 1 },
      },
    ],
    accessors: [] as Record<string, unknown>[],
    bufferViews: [] as Record<string, unknown>[],
    buffers: [{ byteLength: 0 }],
  };
  const chunks: Uint8Array[] = [];
  let offset = 0;

  const addView = (bytes: Uint8Array): number => {
    json.bufferViews.push({
      buffer: 0,
      byteOffset: offset,
      byteLength: bytes.byteLength,
      target: ARRAY_BUFFER,
    });
    const padded = new Uint8Array(pad4(bytes.byteLength));
    padded.set(bytes);
    chunks.push(padded);
    offset += padded.byteLength;
    return json.bufferViews.length - 1;
  };

  const addMesh = (name: string, mesh: MeshData): number => {
    const count = mesh.positions.length / 3;
    const pos = new Float32Array(mesh.positions);
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < pos.length; i++) {
      min[i % 3] = Math.min(min[i % 3]!, pos[i]!);
      max[i % 3] = Math.max(max[i % 3]!, pos[i]!);
    }
    const col = new Uint8Array(count * 4);
    for (let i = 0; i < count; i++) {
      for (let c = 0; c < 3; c++)
        col[i * 4 + c] = Math.round(Math.max(0, Math.min(1, mesh.colors[i * 3 + c]!)) * 255);
      col[i * 4 + 3] = 255;
    }
    const accessor = (
      view: number,
      componentType: number,
      type: string,
      extra: Record<string, unknown> = {},
    ) => {
      json.accessors.push({ bufferView: view, componentType, count, type, ...extra });
      return json.accessors.length - 1;
    };
    const POSITION = accessor(addView(new Uint8Array(pos.buffer)), FLOAT, 'VEC3', { min, max });
    const NORMAL = accessor(addView(new Uint8Array(new Float32Array(mesh.normals).buffer)), FLOAT, 'VEC3');
    const COLOR_0 = accessor(addView(col), UNSIGNED_BYTE, 'VEC4', { normalized: true });
    json.meshes.push({ name, primitives: [{ attributes: { POSITION, NORMAL, COLOR_0 }, material: 0 }] });
    return json.meshes.length - 1;
  };

  const addNode = (n: NodeData): number => {
    const node: Record<string, unknown> = { name: n.name };
    if (n.translation) node.translation = n.translation;
    if (n.rotation) node.rotation = n.rotation;
    if (n.scale) node.scale = n.scale;
    const index = json.nodes.length;
    json.nodes.push(node);
    if (n.mesh) node.mesh = addMesh(n.name, n.mesh);
    if (n.children?.length) node.children = n.children.map(addNode);
    return index;
  };

  json.scenes[0]!.nodes = roots.map(addNode);
  json.buffers[0]!.byteLength = offset;

  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonLen = pad4(jsonBytes.byteLength);
  const total = 12 + 8 + jsonLen + 8 + offset;
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, GLB_MAGIC, true);
  dv.setUint32(4, 2, true);
  dv.setUint32(8, total, true);
  dv.setUint32(12, jsonLen, true);
  dv.setUint32(16, CHUNK_JSON, true);
  out.fill(0x20, 20, 20 + jsonLen); // JSON is padded with spaces
  out.set(jsonBytes, 20);
  let p = 20 + jsonLen;
  dv.setUint32(p, offset, true);
  dv.setUint32(p + 4, CHUNK_BIN, true);
  p += 8;
  for (const c of chunks) {
    out.set(c, p);
    p += c.byteLength;
  }
  return out;
}

// ---------- Reading ----------

export interface WorldNode {
  name: string;
  /** Column-major 4x4 world matrix. */
  matrix: number[];
  hasMesh: boolean;
}

interface GltfNode {
  name?: string;
  translation?: Vec3;
  rotation?: Quat;
  scale?: Vec3;
  matrix?: number[];
  children?: number[];
  mesh?: number;
}

export function readGlbJson(bytes: Uint8Array): {
  nodes?: GltfNode[];
  scenes?: { nodes?: number[] }[];
  scene?: number;
} {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (dv.getUint32(0, true) !== GLB_MAGIC) throw new Error('not a .glb file');
  const jsonLen = dv.getUint32(12, true);
  if (dv.getUint32(16, true) !== CHUNK_JSON) throw new Error('first chunk is not JSON');
  return JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonLen)));
}

/** Every node in the default scene with its world matrix. */
export function worldNodes(bytes: Uint8Array): WorldNode[] {
  const gltf = readGlbJson(bytes);
  const nodes = gltf.nodes ?? [];
  const roots = gltf.scenes?.[gltf.scene ?? 0]?.nodes ?? nodes.map((_, i) => i);
  const out: WorldNode[] = [];
  const visit = (i: number, parent: number[]) => {
    const n = nodes[i]!;
    const world = multiply(
      parent,
      n.matrix ?? compose(n.translation ?? [0, 0, 0], n.rotation ?? [0, 0, 0, 1], n.scale ?? [1, 1, 1]),
    );
    out.push({ name: n.name ?? `node${i}`, matrix: world, hasMesh: n.mesh !== undefined });
    for (const c of n.children ?? []) visit(c, world);
  };
  for (const r of roots) visit(r, IDENTITY);
  return out;
}

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

// prettier-ignore
export function compose(t: Vec3, q: Quat, s: Vec3): number[] {
  const [x, y, z, w] = q;
  const x2 = x + x,
    y2 = y + y,
    z2 = z + z;
  const xx = x * x2,
    xy = x * y2,
    xz = x * z2,
    yy = y * y2,
    yz = y * z2,
    zz = z * z2;
  const wx = w * x2,
    wy = w * y2,
    wz = w * z2;
  return [
    (1 - (yy + zz)) * s[0],
    (xy + wz) * s[0],
    (xz - wy) * s[0],
    0,
    (xy - wz) * s[1],
    (1 - (xx + zz)) * s[1],
    (yz + wx) * s[1],
    0,
    (xz + wy) * s[2],
    (yz - wx) * s[2],
    (1 - (xx + yy)) * s[2],
    0,
    t[0],
    t[1],
    t[2],
    1,
  ];
}

export function multiply(a: number[], b: number[]): number[] {
  const out = new Array<number>(16).fill(0);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[k * 4 + r]! * b[c * 4 + k]!;
      out[c * 4 + r] = sum;
    }
  }
  return out;
}

/** Position, heading around +Y (yaw 0 faces +Z) and per-axis scale from a world matrix. */
export function decompose(m: number[]): { position: Vec3; yaw: number; scale: Vec3 } {
  const sx = Math.hypot(m[0]!, m[1]!, m[2]!);
  const sy = Math.hypot(m[4]!, m[5]!, m[6]!);
  const sz = Math.hypot(m[8]!, m[9]!, m[10]!);
  // The local +Z axis in world space gives the facing.
  const fx = m[8]! / sz;
  const fz = m[10]! / sz;
  return { position: [m[12]!, m[13]!, m[14]!], yaw: Math.atan2(fx, fz), scale: [sx, sy, sz] };
}

export function yawQuat(yaw: number): Quat {
  return [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)];
}
