import { BoxGeometry, Color, Mesh, MeshNormalMaterial, PerspectiveCamera, Scene, WebGLRenderer } from 'three';

const MAX_PIXEL_RATIO = 2;

/** M0 placeholder scene: a spinning cube, sized to the letterboxed canvas. */
export class Renderer {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(60, 16 / 9, 0.1, 100);
  private readonly cube: Mesh;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
    this.scene.background = new Color(0x10141c);
    this.camera.position.set(0, 0, 4);
    this.cube = new Mesh(new BoxGeometry(1.4, 1.4, 1.4), new MeshNormalMaterial());
    this.scene.add(this.cube);
    this.resize();
    new ResizeObserver(() => this.resize()).observe(canvas);
  }

  resize(): void {
    const { clientWidth: w, clientHeight: h } = this.canvas;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  frame(dt: number): void {
    this.cube.rotation.x += dt * 0.7;
    this.cube.rotation.y += dt * 1.1;
    this.renderer.render(this.scene, this.camera);
  }
}
