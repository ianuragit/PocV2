import { Raycaster, Vector2, type PerspectiveCamera } from 'three';
import type { Input } from '../sim';
import type { ScreenPoint } from './overlay';

/** Fraction of the canvas width or height, from any edge, where a click reloads instead of firing. */
export const BORDER_ZONE = 0.04;

export interface InputHandlers {
  /** Called for clicks and keys that are not gameplay, e.g. on menus. Return true to swallow the event. */
  onAction(action: 'click' | 'pause' | 'fullscreen'): boolean;
}

/**
 * Pointer and keyboard capture. Turns a click into a ray with the Three.js camera and queues
 * Fire, Reload and Pause for the next simulation step. Aim is absolute, like a light gun.
 */
export class InputCapture {
  pointer: ScreenPoint | null = null;
  private queue: Input[] = [];
  private readonly raycaster = new Raycaster();

  constructor(
    private readonly surface: HTMLElement,
    private readonly camera: PerspectiveCamera,
    private readonly handlers: InputHandlers,
  ) {
    surface.addEventListener('pointermove', (e) => (this.pointer = this.local(e)));
    surface.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    surface.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => this.onKey(e));
  }

  /** Inputs since the last call. */
  drain(): Input[] {
    const q = this.queue;
    this.queue = [];
    return q;
  }

  inBorderZone(p: ScreenPoint): boolean {
    const w = this.surface.clientWidth;
    const h = this.surface.clientHeight;
    return (
      p.x < w * BORDER_ZONE ||
      p.x > w * (1 - BORDER_ZONE) ||
      p.y < h * BORDER_ZONE ||
      p.y > h * (1 - BORDER_ZONE)
    );
  }

  /** Fires at a point on the surface in CSS pixels, exactly as a click there would. */
  fireAt(p: ScreenPoint): void {
    this.pointer = p;
    if (this.inBorderZone(p)) {
      this.queue.push({ type: 'reload' });
      return;
    }
    const ndc = new Vector2(
      (p.x / this.surface.clientWidth) * 2 - 1,
      -(p.y / this.surface.clientHeight) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const { origin, direction } = this.raycaster.ray;
    this.queue.push({
      type: 'fire',
      origin: { x: origin.x, y: origin.y, z: origin.z },
      direction: { x: direction.x, y: direction.y, z: direction.z },
    });
  }

  queueReload(): void {
    this.queue.push({ type: 'reload' });
  }

  queuePause(): void {
    this.queue.push({ type: 'pause' });
  }

  private local(e: PointerEvent): ScreenPoint {
    const r = this.surface.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private onPointerDown(e: PointerEvent): void {
    const p = this.local(e);
    this.pointer = p;
    if (this.handlers.onAction('click')) return;
    if (e.button === 2) this.queueReload();
    else if (e.button === 0) this.fireAt(p);
  }

  private onKey(e: KeyboardEvent): void {
    if (e.repeat) return;
    const key = e.key.toLowerCase();
    if (key === 'f') {
      this.handlers.onAction('fullscreen');
    } else if (key === 'escape' || key === 'p') {
      if (!this.handlers.onAction('pause')) this.queuePause();
    } else if (key === 'r' || key === ' ') {
      e.preventDefault();
      this.queueReload();
    }
  }
}
