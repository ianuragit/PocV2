import type { App } from '../app.ts';
import { hitZones, type GameState, type HitZone } from '../sim/index.ts';
import { project, type DrawnRing, type ScreenPoint } from '../view/overlay.ts';

export interface DebugHooks {
  state(): GameState;
  events(): unknown[];
  /** Clicks the title (or results) screen. */
  start(): void;
  /** Fires at canvas-relative CSS pixels, through the same path as a real click. */
  fireAt(x: number, y: number): void;
  reload(): void;
  stepFrames(n: number): unknown[];
  /** Restart the stage at a stop (1-based, like the ?stop= URL parameter) and keep playing. */
  skipToStop(n: number): void;
  /** Stop or resume the frame loop's simulation steps (rendering continues). */
  hold(on: boolean): void;
  /** Where a hit zone of an actor is on screen, in canvas CSS pixels. */
  zoneScreen(id: number, zone: HitZone): ScreenPoint | null;
  /** The rings the last frame drew. */
  rings(): DrawnRing[];
}

export function installDebugHooks(app: App): void {
  const surface = document.querySelector<HTMLElement>('#stage')!;
  const hooks: DebugHooks = {
    state: () => structuredClone(app.game.state),
    events: () => [...app.eventLog],
    start: () => void app.onAction('click'),
    fireAt: (x, y) => app.input.fireAt({ x, y }),
    reload: () => app.input.queueReload(),
    stepFrames: (n) => app.stepFrames(n),
    skipToStop: (n) => {
      app.newGame(n - 1);
      if (app.screens.current !== 'playing') app.start();
    },
    hold: (on) => (app.hold = on),
    zoneScreen: (id, zone) => {
      const actor = app.game.state.actors.find((a) => a.id === id);
      if (!actor) return null;
      const z = hitZones(actor, app.tuning.body);
      const p =
        zone === 'head'
          ? z.head.center
          : zone === 'gun_hand'
            ? z.hand.center
            : { x: z.body.base.x, y: (z.body.y0 + z.body.y1) / 2, z: z.body.base.z };
      return project(app.renderer.camera, p, surface.clientWidth, surface.clientHeight);
    },
    rings: () => app.overlay.lastRings,
  };
  (window as unknown as { __game: DebugHooks }).__game = hooks;
}
