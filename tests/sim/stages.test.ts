import { describe, expect, it } from 'vitest';
import { multiplierFor } from '../../src/sim/score.ts';
import type { Markers } from '../../src/sim/types.ts';
import { newGame, readJson, tuning } from '../helpers.ts';
import { runClearingBot, runIdleBot } from './bots.ts';

const STAGES = [
  { id: 'stage2', stops: 9, hits: 62, score: 67_700, rank: 'A' },
  { id: 'stage3', stops: 9, hits: 60, score: 65_300, rank: 'A' },
] as const;

describe.each(STAGES)('$id', ({ id, stops, hits, score, rank }) => {
  const stage = readJson(`public/data/stages/${id}.json`);
  const markers = readJson<Markers>(`public/data/stages/${id}.markers.json`);
  const game = (difficulty: 'easy' | 'normal' | 'hard' = 'normal') =>
    newGame({ seed: 42, difficulty, stage, markers });

  it('the clearing bot finishes every stop, boss included, with the exact expected score', () => {
    const t = tuning();
    const g = game();
    const { events } = runClearingBot(g, t);
    const types = events.map((e) => e.event.type);
    expect(g.state.phase).toBe('stageClear');
    expect(types.filter((x) => x === 'StopReached')).toHaveLength(stops);
    for (const bad of ['PlayerHit', 'Miss', 'CoverHit', 'ShieldBlock', 'CivilianHit', 'CrateOpened']) {
      expect(types, bad).not.toContain(bad);
    }
    expect(types).toContain('BossDefeated');
    const hitEvents = events.flatMap((e) => (e.event.type === 'EnemyHit' ? [e.event] : []));
    expect(hitEvents).toHaveLength(hits);
    let expected = t.boss.bonus;
    hitEvents.forEach((h, streak) => (expected += t.scoring[h.zone] * multiplierFor(streak, t.scoring)));
    expect(expected).toBe(score);
    expect(g.state.result).toEqual({ score, rank, accuracy: 100, continuesUsed: 0 });
  });

  it('is finishable on every difficulty without continues', () => {
    for (const d of ['easy', 'normal', 'hard'] as const) {
      const g = game(d);
      runClearingBot(g, tuning());
      expect(g.state.phase, d).toBe('stageClear');
      expect(g.state.continuesUsed, d).toBe(0);
    }
  });

  it('beats a player who never shoots, and never hangs', () => {
    const g = game();
    runIdleBot(g);
    expect(g.state.phase).toBe('gameOver');
  });
});
