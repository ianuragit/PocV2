import type { MeshData } from '../glb.ts';

/** sRGB hex to linear RGB, so colours in the .glb display as authored (glTF vertex colours are linear). */
export function linear(hex: number): [number, number, number] {
  const c = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return [c((hex >> 16) & 255), c((hex >> 8) & 255), c(hex & 255)];
}

/** Accumulates flat-shaded, vertex-coloured boxes and tiles into one mesh (one draw call). */
export class MeshBuilder {
  readonly mesh: MeshData = { positions: [], normals: [], colors: [] };

  private quad(a: number[], b: number[], c: number[], d: number[], n: number[], color: number): void {
    const rgb = linear(color);
    for (const v of [a, b, c, a, c, d]) {
      this.mesh.positions.push(v[0]!, v[1]!, v[2]!);
      this.mesh.normals.push(n[0]!, n[1]!, n[2]!);
      this.mesh.colors.push(...rgb);
    }
  }

  /** Axis-aligned box from (x0, y0, z0) to (x1, y1, z1). Faces wind counter-clockwise from outside. */
  box(
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    color: number,
    opts: { top?: number; bottom?: boolean } = {},
  ): void {
    const [ax, bx] = [Math.min(x0, x1), Math.max(x0, x1)];
    const [ay, by] = [Math.min(y0, y1), Math.max(y0, y1)];
    const [az, bz] = [Math.min(z0, z1), Math.max(z0, z1)];
    this.quad([ax, by, az], [ax, by, bz], [bx, by, bz], [bx, by, az], [0, 1, 0], opts.top ?? color);
    if (opts.bottom) this.quad([ax, ay, az], [bx, ay, az], [bx, ay, bz], [ax, ay, bz], [0, -1, 0], color);
    this.quad([ax, ay, bz], [bx, ay, bz], [bx, by, bz], [ax, by, bz], [0, 0, 1], color);
    this.quad([bx, ay, az], [ax, ay, az], [ax, by, az], [bx, by, az], [0, 0, -1], color);
    this.quad([bx, ay, bz], [bx, ay, az], [bx, by, az], [bx, by, bz], [1, 0, 0], color);
    this.quad([ax, ay, az], [ax, ay, bz], [ax, by, bz], [ax, by, az], [-1, 0, 0], color);
  }

  /** A checker of square tiles facing up at height y. */
  tiles(x0: number, z0: number, x1: number, z1: number, y: number, size: number, a: number, b: number): void {
    for (let x = x0, i = 0; x < x1 - 1e-6; x += size, i++) {
      for (let z = z0, j = 0; z < z1 - 1e-6; z += size, j++) {
        const xe = Math.min(x1, x + size);
        const ze = Math.min(z1, z + size);
        this.quad([x, y, z], [x, y, ze], [xe, y, ze], [xe, y, z], [0, 1, 0], (i + j) % 2 === 0 ? a : b);
      }
    }
  }

  /** A downward-facing ceiling panel at height y. */
  ceiling(x0: number, z0: number, x1: number, z1: number, y: number, color: number): void {
    this.quad([x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], [0, -1, 0], color);
  }

  get triangles(): number {
    return this.mesh.positions.length / 9;
  }
}
