import { Vector3, type PerspectiveCamera } from 'three';
import type { Actor, Ring, Tuning } from '../sim/index.ts';
import { SIGHT_COLORS } from './style.ts';

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

export type BurstKind = 'hit' | 'civilian' | 'miss';

interface Burst {
  x: number;
  y: number;
  kind: BurstKind;
  age: number;
  spin: number;
}

const BURST_SECONDS = 0.14;
const BURST_COLORS: Record<BurstKind, [string, string]> = {
  hit: ['#fff6c2', '#ffb020'],
  civilian: ['#e6f3ff', '#67b6ff'],
  miss: ['#f0f0f0', '#9aa3ad'],
};

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
 * The 2D layer over the WebGL canvas: threat sights, hit sparks, the crosshair and the border-zone hint.
 * Drawn every frame at the latest pointer position, so the crosshair never lags the hand.
 */
export class Overlay {
  private readonly ctx: CanvasRenderingContext2D;
  /** What the last frame drew, for tests and the debug overlay. */
  lastRings: DrawnRing[] = [];
  private bursts: Burst[] = [];
  private clock = 0;

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
      ? SIGHT_COLORS.danger
      : progress >= r.amber_at
        ? SIGHT_COLORS.warn
        : SIGHT_COLORS.safe;
  }

  /** A short spark where a shot landed. */
  burst(at: ScreenPoint | null, kind: BurstKind): void {
    if (at) this.bursts.push({ x: at.x, y: at.y, kind, age: 0, spin: (this.bursts.length * 0.9) % Math.PI });
  }

  clearEffects(): void {
    this.bursts = [];
  }

  draw(opts: {
    dt: number;
    camera: PerspectiveCamera;
    rings: readonly Ring[];
    actors: readonly Actor[];
    pointer: ScreenPoint | null;
    showCrosshair: boolean;
    borderZone: boolean;
    debug: boolean;
    /** No blinking when the player has asked for fewer flashes. */
    reducedFlash?: boolean;
  }): void {
    const { w, h } = this.fit();
    const ctx = this.ctx;
    const body = this.tuning.body;
    this.lastRings = [];
    this.clock += opts.dt;

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
      // About to fire: blink, so the next shot is never a surprise.
      const blinkOff =
        !opts.reducedFlash &&
        ring.progress >= this.tuning.rings.red_at &&
        Math.floor(this.clock * 16) % 2 === 1;
      if (!blinkOff) drawSight(ctx, c.x, c.y, radius, ring.progress, color, h);
      if (opts.debug) {
        ctx.fillStyle = '#fff';
        ctx.font = `${Math.round(h * 0.022)}px ui-monospace, monospace`;
        ctx.fillText(`#${ring.id} ${(ring.progress * 100).toFixed(0)}%`, c.x + 8, c.y - 8);
      }
      this.lastRings.push({ id: ring.id, x: c.x, y: c.y, radius, color });
    }

    for (const b of this.bursts) {
      b.age += opts.dt;
      drawBurst(ctx, b, h);
    }
    this.bursts = this.bursts.filter((b) => b.age < BURST_SECONDS);

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

/**
 * The threat sight: four corner brackets that start as a wide diamond and close into a tight
 * square on the target as the shot nears, with a centre pip marking where to aim.
 */
function drawSight(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  progress: number,
  color: string,
  h: number,
): void {
  const angle = (Math.PI / 4) * (1 - progress);
  const s = r * 0.8;
  const arm = Math.max(6, s * 0.42);
  const width = Math.max(2, h * (progress > 0.75 ? 0.009 : 0.006));
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.lineJoin = 'miter';
  ctx.lineCap = 'square';
  ctx.strokeStyle = 'rgba(0,0,0,0.65)';
  ctx.lineWidth = width + 3;
  bracketPath(ctx, s, arm);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  bracketPath(ctx, s, arm);
  ctx.stroke();
  // Inward ticks at the edge midpoints.
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    ctx.moveTo(Math.cos(a) * s, Math.sin(a) * s);
    ctx.lineTo(Math.cos(a) * (s - arm * 0.45), Math.sin(a) * (s - arm * 0.45));
  }
  ctx.stroke();
  ctx.restore();
  const pip = Math.max(3, h * 0.006);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - pip);
  ctx.lineTo(x + pip, y);
  ctx.lineTo(x, y + pip);
  ctx.lineTo(x - pip, y);
  ctx.closePath();
  ctx.fill();
}

function bracketPath(ctx: CanvasRenderingContext2D, s: number, arm: number): void {
  ctx.beginPath();
  for (const [sx, sy] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ] as const) {
    ctx.moveTo(sx * s, sy * s + -sy * arm);
    ctx.lineTo(sx * s, sy * s);
    ctx.lineTo(sx * s + -sx * arm, sy * s);
  }
}

/** A hard-edged star of triangles: big and bright for a hit, small and grey for a miss. */
function drawBurst(ctx: CanvasRenderingContext2D, b: Burst, h: number): void {
  const t = b.age / BURST_SECONDS;
  const size = h * (b.kind === 'miss' ? 0.025 : 0.05) * (0.6 + t * 0.6);
  const [inner, outer] = BURST_COLORS[b.kind];
  const points = b.kind === 'miss' ? 5 : 8;
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.spin);
  ctx.globalAlpha = 1 - t * 0.7;
  for (const [scale, color] of [
    [1, outer],
    [0.55, inner],
  ] as const) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const rad = (i % 2 === 0 ? size : size * 0.3) * scale;
      const a = (i * Math.PI) / points;
      if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
      else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}
