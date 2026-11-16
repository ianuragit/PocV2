import {
  CapsuleGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  SphereGeometry,
  BoxGeometry,
  BackSide,
  type Material,
} from 'three';
import type { Actor, Tuning } from '../sim';

const COLORS: Record<string, number> = {
  grunt: 0xc0392b,
  runner: 0xe67e22,
  heavy: 0x6d1f1a,
  civilian: 0x3d7bd9,
};
const RESOLVED = new Set(['dead', 'disarmed', 'fled']);
const FADE_SECONDS = 0.35;

interface Entry {
  root: Group;
  debug: Group;
  materials: (MeshLambertMaterial | MeshBasicMaterial)[];
  entryTotal: number;
  resolvedFor: number;
}

/**
 * Capsule stand-ins for every actor. Reads simulation state; never writes it.
 * Enemies fade in while entering and fall away when resolved; civilians carry a blue outline.
 */
export class ActorsView {
  readonly root = new Group();
  private readonly entries = new Map<number, Entry>();

  constructor(private readonly tuning: Tuning) {
    this.root.name = 'actors';
  }

  sync(actors: readonly Actor[], dt: number, debug: boolean): void {
    const seen = new Set<number>();
    for (const actor of actors) {
      seen.add(actor.id);
      let e = this.entries.get(actor.id);
      if (!e) {
        e = this.create(actor);
        this.entries.set(actor.id, e);
        this.root.add(e.root);
      }
      this.update(e, actor, dt);
      e.debug.visible = debug && !RESOLVED.has(actor.phase);
    }
    for (const [id, e] of this.entries) {
      if (!seen.has(id)) {
        this.root.remove(e.root);
        e.root.traverse((o) => {
          if (o instanceof Mesh) {
            o.geometry.dispose();
            (o.material as Material).dispose();
          }
        });
        this.entries.delete(id);
      }
    }
  }

  private create(actor: Actor): Entry {
    const b = this.tuning.body;
    const root = new Group();
    root.position.set(actor.position.x, actor.position.y, actor.position.z);
    root.rotation.y = actor.yaw;
    const color = COLORS[actor.type] ?? 0x999999;
    const mat = new MeshLambertMaterial({ color, transparent: true });
    const skin = new MeshLambertMaterial({ color: 0xe0b48a, transparent: true });
    const materials: Entry['materials'] = [mat, skin];

    const bodyLength = b.body_top - b.body_bottom;
    const width = actor.type === 'heavy' ? 1.25 : 1;
    const torso = new Mesh(new CapsuleGeometry(b.body_radius * width, bodyLength, 4, 12), mat);
    torso.position.y = b.body_bottom + bodyLength / 2;
    root.add(torso);
    const head = new Mesh(new SphereGeometry(b.head_radius, 16, 12), skin);
    head.position.y = b.head_height;
    root.add(head);

    if (actor.civilian) {
      // Civilians read as blue at a glance: an outline drawn as a slightly larger back-faced shell.
      const outline = new MeshBasicMaterial({ color: 0x66b3ff, side: BackSide, transparent: true });
      materials.push(outline);
      const shell = new Mesh(new CapsuleGeometry(b.body_radius * 1.18, bodyLength + 0.1, 4, 12), outline);
      shell.position.copy(torso.position);
      root.add(shell);
    } else {
      // Gun hand: local +X is the actor's left, so the right hand sits at -X (matches sim basis).
      const [hr, hu, hf] = b.hand_offset;
      const gun = new Mesh(
        new BoxGeometry(0.08, 0.12, 0.28),
        new MeshLambertMaterial({ color: 0x222222, transparent: true }),
      );
      materials.push(gun.material as MeshLambertMaterial);
      gun.position.set(-hr, hu, hf);
      root.add(gun);
    }
    const debug = this.buildDebugZones();
    root.add(debug);
    return { root, debug, materials, entryTotal: Math.max(1, actor.timer), resolvedFor: 0 };
  }

  /** Wireframes of the simulation's hit zones, in the actor's local space (see sim/shots.ts hitZones). */
  private buildDebugZones(): Group {
    const b = this.tuning.body;
    const wire = new MeshBasicMaterial({ color: 0x00ffcc, wireframe: true });
    const g = new Group();
    const head = new Mesh(new SphereGeometry(b.head_radius, 8, 6), wire);
    head.position.y = b.head_height;
    const [hr, hu, hf] = b.hand_offset;
    const hand = new Mesh(new SphereGeometry(b.hand_radius, 8, 6), wire);
    hand.position.set(-hr, hu, hf);
    const len = b.body_top - b.body_bottom;
    const body = new Mesh(new CapsuleGeometry(b.body_radius, len, 2, 8), wire);
    body.position.y = b.body_bottom + len / 2;
    g.add(head, hand, body);
    g.visible = false;
    return g;
  }

  private update(e: Entry, actor: Actor, dt: number): void {
    let opacity = 1;
    if (actor.phase === 'entering') {
      // Fade in rather than scale, so what you see always matches the simulation's hit zones.
      opacity = 0.35 + 0.65 * (1 - actor.timer / e.entryTotal);
    }
    if (RESOLVED.has(actor.phase)) {
      e.resolvedFor += dt;
      opacity = Math.max(0, 1 - e.resolvedFor / FADE_SECONDS);
      e.root.rotation.x = actor.phase === 'dead' ? -Math.min(1, e.resolvedFor / FADE_SECONDS) * 1.2 : 0;
    }
    e.root.visible = opacity > 0;
    for (const m of e.materials) m.opacity = opacity;
  }
}
