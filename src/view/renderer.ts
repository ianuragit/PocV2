import {
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { Vec3 } from '../sim';
import { RENDER_LINES, SKY } from './style';

const LOOK_SMOOTHING = 6; // per second; higher turns the camera faster toward a new look target

/**
 * Owns the WebGL renderer, scene and camera. The canvas is letterboxed to 16:9 by CSS.
 * The 3D scene renders at RENDER_LINES lines and CSS scales it up with hard pixel edges.
 */
export class Renderer {
  readonly gl: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(60, 16 / 9, 0.1, 400);
  private readonly look = new Vector3();
  private lookInitialised = false;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.gl = new WebGLRenderer({ canvas, antialias: false });
    this.scene.background = new Color(SKY.horizon);
    this.scene.fog = new Fog(SKY.fog, 40, 120);
    this.scene.add(new HemisphereLight(0xffffff, 0x8a7a5a, 1.5));
    const sun = new DirectionalLight(0xfff2d8, 2.2);
    sun.position.set(-6, 12, -4);
    this.scene.add(sun);
    this.resize();
    new ResizeObserver(() => this.resize()).observe(canvas);
  }

  resize(): void {
    const { clientWidth: w, clientHeight: h } = this.canvas;
    if (w === 0 || h === 0) return;
    this.gl.setPixelRatio(RENDER_LINES / h);
    this.gl.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Places the camera; the look direction eases toward its target so stop changes turn smoothly. */
  placeCamera(position: Vec3, lookAt: Vec3, dt: number): void {
    this.camera.position.set(position.x, position.y, position.z);
    const target = new Vector3(lookAt.x, lookAt.y, lookAt.z);
    if (!this.lookInitialised || dt <= 0) {
      this.look.copy(target);
      this.lookInitialised = true;
    } else {
      this.look.lerp(target, 1 - Math.exp(-LOOK_SMOOTHING * dt));
    }
    this.camera.lookAt(this.look);
    this.camera.updateMatrixWorld();
  }

  /** Snap the look direction on the next placement (new game, debug jumps). */
  resetLook(): void {
    this.lookInitialised = false;
  }

  render(): void {
    this.gl.render(this.scene, this.camera);
  }
}
