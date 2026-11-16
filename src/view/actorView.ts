import { CapsuleGeometry, Group, Mesh, MeshBasicMaterial, SphereGeometry, type Material } from 'three';
import type { Actor, Tuning } from '../sim/index.ts';
import { buildCharacter, type Character } from './characters.ts';

const RESOLVED = new Set(['dead', 'disarmed', 'fled']);
const FADE_SECONDS = 0.5;

interface Entry {
  character: Character;
  debug: Group;
  entryTotal: number;
  resolvedFor: number;
  /** Seconds since the actor appeared; drives idle motion. */
  age: number;
  /** Per-actor phase offset so a group does not move in lockstep. */
  seed: number;
}

/**
 * Draws every actor as a blocky character. Reads simulation state; never writes it.
 * Motion stays small (a few centimetres) so the model keeps matching the hit zones.
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
        this.root.add(e.character.root);
      }
      this.update(e, actor, dt);
      e.debug.visible = debug && !RESOLVED.has(actor.phase);
    }
    for (const [id, e] of this.entries) {
      if (seen.has(id)) continue;
      this.root.remove(e.character.root);
      e.character.root.traverse((o) => {
        if (o instanceof Mesh) o.geometry.dispose();
      });
      for (const m of e.character.materials) m.dispose();
      this.entries.delete(id);
    }
  }

  private create(actor: Actor): Entry {
    const character = buildCharacter(actor.type, actor.civilian, this.tuning.body);
    character.root.position.set(actor.position.x, actor.position.y, actor.position.z);
    character.root.rotation.y = actor.yaw;
    const debug = this.buildDebugZones();
    character.root.add(debug);
    return {
      character,
      debug,
      entryTotal: Math.max(1, actor.timer),
      resolvedFor: 0,
      age: 0,
      seed: actor.id * 1.7,
    };
  }

  private update(e: Entry, actor: Actor, dt: number): void {
    const c = e.character;
    e.age += dt;
    let opacity = 1;

    if (actor.phase === 'entering') {
      // Fade in rather than scale, so what you see always matches the simulation's hit zones.
      opacity = 0.35 + 0.65 * (1 - actor.timer / e.entryTotal);
    }

    // Idle: a slight breathing bob; while aiming, a small sway that grows as the shot nears.
    const t = e.age + e.seed;
    c.torso.position.y = Math.sin(t * 3) * 0.008;
    c.torso.rotation.z = actor.phase === 'aiming' ? Math.sin(t * 9) * 0.015 : 0;

    if (RESOLVED.has(actor.phase)) {
      e.resolvedFor += dt;
      const k = Math.min(1, e.resolvedFor / FADE_SECONDS);
      if (actor.phase === 'dead') {
        // Knocked backward from the feet, then fades.
        c.root.rotation.x = -k * 1.35;
        opacity = 1 - Math.max(0, (e.resolvedFor - 0.25) / FADE_SECONDS);
      } else if (actor.phase === 'disarmed') {
        // Gun gone, hands up, then fades.
        if (c.gun) c.gun.visible = false;
        c.gunArm.rotation.x = -1.2;
        c.offArm.rotation.x = -1.2;
        opacity = 1 - Math.max(0, (e.resolvedFor - 0.45) / FADE_SECONDS);
      } else {
        opacity = 1 - k;
      }
    }

    c.root.visible = opacity > 0;
    for (const m of c.materials) m.opacity = Math.max(0, opacity);
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
