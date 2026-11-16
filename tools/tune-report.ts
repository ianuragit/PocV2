/**
 * npm run tune-report: plays every stage on every difficulty with bots that behave like people of
 * different skill (a reaction delay and some aim wobble), and prints how often each one clears,
 * how many lives it loses, and what it scores. Use it to set tuning.json numbers with evidence;
 * it changes nothing by itself.
 */
import { readFileSync } from 'node:fs';
import { createGame } from '../src/sim/game.ts';
import { createRng } from '../src/sim/rng.ts';
import { hitZones } from '../src/sim/shots.ts';
import { add, sub, vec, type Vec3 } from '../src/sim/vec.ts';
import type { Actor, Difficulty, Input, Markers, Tuning } from '../src/sim/types.ts';

interface Profile {
  name: string;
  /** Seconds from an enemy appearing to the first shot at it. */
  reaction: number;
  /** Standard deviation of aim error at the target, in metres. */
  wobble: number;
  /** Extra seconds between shots after the first, on top of the weapon's rate limit. */
  rhythm: number;
}

export const PROFILES: Profile[] = [
  { name: 'sharp', reaction: 0.45, wobble: 0.06, rhythm: 0.12 },
  { name: 'average', reaction: 0.7, wobble: 0.11, rhythm: 0.25 },
  { name: 'casual', reaction: 1.0, wobble: 0.16, rhythm: 0.4 },
];

const readJson = <T>(p: string): T => JSON.parse(readFileSync(p, 'utf8')) as T;
const LIVE = new Set(['entering', 'waiting', 'aiming', 'flying']);

export interface RunResult {
  cleared: boolean;
  livesLost: number;
  continues: number;
  score: number;
  accuracy: number;
}

/** One run. Like a person: shoots whichever threat is closest to firing, misses sometimes, reloads when dry. */
export function playLikeAPerson(
  stageId: string,
  difficulty: Difficulty,
  profile: Profile,
  seed: number,
): RunResult {
  const tuning = readJson<Tuning>('public/data/tuning.json');
  const stage = readJson(`public/data/stages/${stageId}.json`);
  const markers = readJson<Markers>(`public/data/stages/${stageId}.markers.json`);
  const game = createGame({ stage, markers, tuning, difficulty, seed });
  const rng = createRng(seed * 7919 + 17);
  const gauss = () => {
    const u = Math.max(1e-9, rng.next());
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng.next());
  };
  const hz = tuning.step_hz;
  const seenAt = new Map<number, number>();
  let nextShotAt = 0;
  let livesLost = 0;
  let inputs: Input[] = [];

  const aimPoint = (a: Actor): Vec3 => {
    if (a.role === 'projectile') return a.position;
    const z = hitZones(a, tuning.body);
    if (tuning.enemies[a.type]?.shield) return z.head.center;
    return vec(z.body.base.x, (z.body.y0 + z.body.y1) / 2, z.body.base.z);
  };
  const urgency = (a: Actor) =>
    a.role === 'projectile' ? 2 : a.phase === 'aiming' ? 1 + a.ringElapsed / Math.max(1, a.ringFrames) : 0;

  for (let step = 0; step < 60 * 60 * 20; step++) {
    const events = game.step(inputs);
    inputs = [];
    const s = game.state;
    for (const e of events) if (e.type === 'PlayerHit') livesLost += 1;
    if (s.phase === 'continue') {
      inputs.push({ type: 'continue' });
      continue;
    }
    if (s.phase === 'stageClear' || s.phase === 'gameOver') break;
    for (const a of s.actors) if (!seenAt.has(a.id)) seenAt.set(a.id, s.frame);
    if (s.weapon.ammo === 0) {
      if (s.weapon.kind === 'revolver' && s.weapon.reloading === 0) inputs.push({ type: 'reload' });
      continue;
    }
    if (s.frame < nextShotAt || s.weapon.cooldown > 0) continue;
    const ready = s.actors
      .filter(
        (a) => (a.role === 'enemy' || a.role === 'boss' || a.role === 'projectile') && LIVE.has(a.phase),
      )
      .filter((a) => s.frame - seenAt.get(a.id)! >= profile.reaction * hz)
      .sort((a, b) => urgency(b) - urgency(a) || a.id - b.id);
    const target = ready[0];
    if (!target) continue;
    const aim = add(aimPoint(target), vec(gauss() * profile.wobble, gauss() * profile.wobble, 0));
    inputs.push({ type: 'fire', origin: s.camera.position, direction: sub(aim, s.camera.position) });
    nextShotAt = s.frame + Math.round(profile.rhythm * hz);
  }
  const s = game.state;
  return {
    cleared: s.phase === 'stageClear',
    livesLost,
    continues: s.continuesUsed,
    score: s.score.score,
    accuracy: s.score.shots ? Math.round((s.score.shotsOnTarget / s.score.shots) * 100) : 0,
  };
}

function main(): void {
  const seeds = [1, 2, 3, 4, 5];
  const stages = ['stage1', 'stage2', 'stage3'];
  const pad = (v: string | number, n: number) => String(v).padStart(n);
  console.log(
    '| Stage | Difficulty | Player | Cleared without continues | Lives lost (avg) | Continues (avg) | Score (avg) | Hit rate |',
  );
  console.log('| --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const stageId of stages) {
    for (const difficulty of ['easy', 'normal', 'hard'] as Difficulty[]) {
      for (const p of PROFILES) {
        const runs = seeds.map((seed) => playLikeAPerson(stageId, difficulty, p, seed));
        const avg = (f: (r: RunResult) => number) => runs.reduce((n, r) => n + f(r), 0) / runs.length;
        const clean = runs.filter((r) => r.cleared && r.continues === 0).length;
        console.log(
          `| ${stageId} | ${difficulty} | ${p.name} | ${clean}/${runs.length} | ${pad(avg((r) => r.livesLost).toFixed(1), 4)} | ${avg((r) => r.continues).toFixed(1)} | ${Math.round(avg((r) => r.score))} | ${Math.round(avg((r) => r.accuracy))}% |`,
        );
      }
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
