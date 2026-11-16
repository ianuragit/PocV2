import { Vector3, type PerspectiveCamera } from 'three';
import type { Actor, Ring, Tuning } from '../sim';

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface DrawnRing {
  id: number;
  x: number;
  y: number;
  radius: number;
  color: string;
}

const RING_COLORS = { green: '#3ddc84', amber: '#ffb020', red: '#ff3b30' };

/** Projects a world point to CSS pixels on the canvas, or null when it is behind the camera. */
export function project(
  camera: PerspectiveCamera,
  p: { x: number; y: number; z: number },
  w: number,
  h: number,
): ScreenPoint | null {
  const v = new Vector3(p.x, p.y, p.z).project(camera);
  if (v.z > 1) return null;
  return { x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h };
}

/**
 * The 2D layer over the WebGL canvas: threat rings, the crosshair and the border-zone hint.
 * Drawn every frame at the latest pointer position, so the crosshair never lags the hand.
 */
export class Overlay {
  private readonly ctx: CanvasRenderingContext2D;
  /** What the last frame drew, for tests and the debug overlay. */
  lastRings: DrawnRing[] = [];

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly tuning: Tuning,
  ) {
    this.ctx = canvas.getContext('2d')!;
  }

  private fit(): { w: number; h: number } {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const dpr = Math.min(window.devicePixelRatio, 2);
    if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) {
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
    }
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.clearRect(0, 0, w, h);
    return { w, h };
  }

  ringColor(progress: number): string {
    const r = this.tuning.rings;
    return progress >= r.red_at
      ? RING_COLORS.red
      : progress >= r.amber_at
        ? RING_COLORS.amber
        : RING_COLORS.green;
  }

  draw(opts: {
    camera: PerspectiveCamera;
    rings: readonly Ring[];
    actors: readonly Actor[];
    pointer: ScreenPoint | null;
    showCrosshair: boolean;
    borderZone: boolean;
    debug: boolean;
  }): void {
    const { w, h } = this.fit();
    const ctx = this.ctx;
    const body = this.tuning.body;
    this.lastRings = [];

    for (const ring of opts.rings) {
      const actor = opts.actors.find((a) => a.id === ring.id);
      if (!actor) continue;
      // Centre on the middle of the body; size from the projected height so distance scales it.
      const mid = { x: actor.position.x, y: actor.position.y + body.height / 2, z: actor.position.z };
      const top = { ...mid, y: mid.y + body.height / 2 };
      const c = project(opts.camera, mid, w, h);
      const t = project(opts.camera, top, w, h);
      if (!c || !t) continue;
      const radius = Math.abs(c.y - t.y) * ring.scale;
      const color = this.ringColor(ring.progress);
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(2, h * 0.006);
      ctx.beginPath();
      ctx.arc(c.x, c.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      // Small inner tick so the target point is readable even when the ring is large.
      ctx.beginPath();
      ctx.arc(c.x, c.y, Math.max(3, h * 0.005), 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      if (opts.debug) {
        ctx.fillStyle = '#fff';
        ctx.font = `${Math.round(h * 0.022)}px ui-monospace, monospace`;
        ctx.fillText(`#${ring.id} ${(ring.progress * 100).toFixed(0)}%`, c.x + 8, c.y - 8);
      }
      this.lastRings.push({ id: ring.id, x: c.x, y: c.y, radius, color });
    }

    if (opts.pointer && opts.showCrosshair) {
      const { x, y } = opts.pointer;
      const s = Math.max(10, h * 0.025);
      ctx.strokeStyle = opts.borderZone ? '#9ad0ff' : '#ffffff';
      ctx.lineWidth = 2;
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 3;
      ctx.beginPath();
      ctx.arc(x, y, s * 0.6, 0, Math.PI * 2);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        ctx.moveTo(x + dx * s * 0.35, y + dy * s * 0.35);
        ctx.lineTo(x + dx * s, y + dy * s);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }
}
