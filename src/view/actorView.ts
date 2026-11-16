import {
  CapsuleGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  Vector3,
  type Material,
} from 'three';
import type { Actor, Tuning } from '../sim/index.ts';
import { buildCharacter, buildCrate, buildProjectile } from './characters.ts';

const RESOLVED = new Set(['dead', 'disarmed', 'fled', 'opened']);
const FADE_SECONDS = 0.5;

interface Entry {
  root: Group;
  materials: Material[];
  /** People only: parts posed per phase. */
  torso?: Group;
  gunArm?: Group;
  offArm?: Group;
  gun?: Mesh | null;
  debug: Group | null;
  entryTotal: number;
  resolvedFor: number;
  /** Seconds since the actor appeared; drives idle motion. */
  age: number;
  /** Per-actor phase offset so a group does not move in lockstep. */
  seed: number;
  /** Boss: where it was standing when a move started. */
  moveFrom?: Vector3;
}

/**
 * Draws every actor. Reads simulation state; never writes it. People are blocky characters whose
 * motion stays within a few centimetres of the rest pose, so the model keeps matching the hit zones.
 */
export class ActorsView {
  readonly root = new Group();
  private readonly entries = new Map<number, Entry>();
  private readonly moveFrames: number;

  constructor(private readonly tuning: Tuning) {
    this.root.name = 'actors';
    this.moveFrames = Math.max(1, Math.round(tuning.boss.move_time * tuning.step_hz));
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
      if (e.debug) e.debug.visible = debug && !RESOLVED.has(actor.phase);
    }
    for (const [id, e] of this.entries) {
      if (seen.has(id)) continue;
      this.root.remove(e.root);
      e.root.traverse((o) => {
        if (o instanceof Mesh) o.geometry.dispose();
      });
      for (const m of e.materials) m.dispose();
      this.entries.delete(id);
    }
  }

  private create(actor: Actor): Entry {
    const base = {
      entryTotal: Math.max(1, actor.timer),
      resolvedFor: 0,
      age: 0,
      seed: actor.id * 1.7,
      debug: null,
    };
    let e: Entry;
    if (actor.role === 'crate') {
      const c = buildCrate(actor.weapon ?? '', this.tuning.crate.half_extents);
      e = { ...base, root: c.root, materials: c.materials };
    } else if (actor.role === 'projectile') {
      const p = buildProjectile();
      e = { ...base, root: p.root, materials: p.materials };
    } else {
      const def = this.tuning.enemies[actor.type];
      const c = buildCharacter(
        actor.type,
        { civilian: actor.civilian, shield: def?.shield === true, thrower: def?.attack === 'throw' },
        this.tuning.body,
      );
      const debug = this.buildDebugZones();
      c.root.add(debug);
      e = { ...base, ...c, debug };
    }
    e.root.position.set(actor.position.x, actor.position.y, actor.position.z);
    e.root.rotation.y = actor.yaw;
    return e;
  }

  private update(e: Entry, actor: Actor, dt: number): void {
    e.age += dt;
    let opacity = 1;

    if (actor.phase === 'entering') {
      // Fade in rather than scale, so what you see always matches the simulation's hit zones.
      opacity = 0.35 + 0.65 * (1 - actor.timer / e.entryTotal);
    }

    if (actor.role === 'projectile') {
      e.root.position.set(actor.position.x, actor.position.y, actor.position.z);
      e.root.rotation.x += dt * 12;
      e.root.rotation.z += dt * 7;
    } else if (actor.phase === 'moving' && actor.boss) {
      // The simulation moves the boss at the end of its move; the view slides it there meanwhile.
      e.moveFrom ??= e.root.position.clone();
      const to = actor.boss.positions[actor.boss.phase]!;
      const k = 1 - actor.timer / this.moveFrames;
      e.root.position.lerpVectors(e.moveFrom, new Vector3(to.x, to.y, to.z), Math.min(1, Math.max(0, k)));
      e.root.rotation.y = actor.boss.yaws[actor.boss.phase]!;
      opacity = 0.6;
    } else {
      e.moveFrom = undefined;
      e.root.position.set(actor.position.x, actor.position.y, actor.position.z);
      e.root.rotation.y = actor.yaw;
    }

    if (e.torso) {
      // Idle: a slight breathing bob; while aiming, a small sway that grows as the shot nears.
      const t = e.age + e.seed;
      e.torso.position.y = Math.sin(t * 3) * 0.008;
      e.torso.rotation.z = actor.phase === 'aiming' ? Math.sin(t * 9) * 0.015 : 0;
    }

    if (RESOLVED.has(actor.phase)) {
      e.resolvedFor += dt;
      const k = Math.min(1, e.resolvedFor / FADE_SECONDS);
      if (actor.phase === 'dead' && e.torso) {
        // Knocked backward from the feet, then fades.
        e.root.rotation.x = -k * 1.35;
        opacity = 1 - Math.max(0, (e.resolvedFor - 0.25) / FADE_SECONDS);
      } else if (actor.phase === 'disarmed' && e.gunArm && e.offArm) {
        // Gun gone, hands up, then fades.
        if (e.gun) e.gun.visible = false;
        e.gunArm.rotation.x = -1.2;
        e.offArm.rotation.x = -1.2;
        opacity = 1 - Math.max(0, (e.resolvedFor - 0.45) / FADE_SECONDS);
      } else if (actor.phase === 'opened') {
        // The crate bursts: a quick swell, then gone.
        e.root.scale.setScalar(1 + k * 0.6);
        opacity = 1 - k;
      } else {
        opacity = 1 - k;
      }
    }

    e.root.visible = opacity > 0;
    for (const m of e.materials) m.opacity = Math.max(0, opacity);
  }

  /** Wireframes of the simulation's hit zones, in the actor's local space (see sim/shots.ts hitZones). */
  private buildDebugZones(): Group {
    const b = this.tuning.body;
    const wire: Material = new MeshBasicMaterial({ color: 0x00ffcc, wireframe: true });
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
}
