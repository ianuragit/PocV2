import { describe, expect, it } from 'vitest';
import { multiplierFor } from '../../src/sim/score.ts';
import { newGame, readJson, tuning } from '../helpers.ts';
import { runClearingBot } from './bots.ts';

describe('clearing bot on stage 1', () => {
  it('clears all 10 stops, boss included, with the exact expected score', () => {
    const t = tuning();
    const game = newGame({ seed: 42 });
    const { events } = runClearingBot(game, t);
    const types = events.map((e) => e.event.type);

    expect(game.state.phase).toBe('stageClear');
    expect(types.filter((x) => x === 'StopReached')).toHaveLength(10);
    for (const bad of ['PlayerHit', 'Miss', 'CoverHit', 'ShieldBlock', 'CivilianHit', 'CrateOpened']) {
      expect(types, bad).not.toContain(bad);
    }
    expect(types).toContain('BossDefeated');
    expect(types.filter((x) => x === 'BossPhase')).toHaveLength(2);

    // 69 straight hits: shield carriers in the head, everyone else (and the boss, 3 x 8) in the body.
    const hits = events.flatMap((e) => (e.event.type === 'EnemyHit' ? [e.event] : []));
    expect(hits).toHaveLength(69);
    expect(hits.filter((h) => h.zone === 'head')).toHaveLength(2);
    let expected = t.boss.bonus;
    hits.forEach((h, streak) => (expected += t.scoring[h.zone] * multiplierFor(streak, t.scoring)));
    expect(expected).toBe(74_000);
    expect(game.state.score.score).toBe(74_000);
    // One bonus life at 50,000.
    expect(game.state.lives).toBe(t.difficulty.normal.lives + 1);
    expect(game.state.result).toEqual({ score: 74_000, rank: 'A', accuracy: 100, continuesUsed: 0 });
    expect(events.at(-1)!.event).toEqual({ type: 'StageCleared', score: 74_000, rank: 'A' });
  });

  it('all three difficulties are finishable', () => {
    for (const difficulty of ['easy', 'normal', 'hard'] as const) {
      const game = newGame({ difficulty });
      runClearingBot(game, tuning());
      expect(game.state.phase, difficulty).toBe('stageClear');
      expect(game.state.result?.continuesUsed, difficulty).toBe(0);
    }
  });

  it('runs the full rail: about a minute at the bot reaction time of 0.5 s', () => {
    const game = newGame({ seed: 42 });
    const { steps } = runClearingBot(game, tuning());
    expect(steps).toBe(4090);
    expect(game.state.camera.pathOffset).toBe(183.5);
  });
});

describe('clearing bot on the firing range', () => {
  it('clears a wave of 5 with 5 straight body hits', () => {
    const game = newGame({
      stage: readJson('public/data/stages/range.json'),
      markers: readJson('public/data/stages/range.markers.json'),
    });
    runClearingBot(game, tuning());
    expect(game.state.phase).toBe('stageClear');
    expect(game.state.score.score).toBe(200 * 3 + 400 * 2);
  });
});
