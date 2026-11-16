import { describe, expect, it } from 'vitest';
import { multiplierFor } from '../../src/sim/score';
import { newGame, tuning } from '../helpers';
import { runClearingBot } from './bots';

describe('clearing bot on stage 1', () => {
  it('clears every stop with the exact expected score', () => {
    const t = tuning();
    const game = newGame({ seed: 42 });
    const { events } = runClearingBot(game, t);
    const types = events.map((e) => e.event.type);

    expect(game.state.phase).toBe('stageClear');
    expect(types.filter((x) => x === 'StopReached')).toHaveLength(5);
    expect(types).not.toContain('PlayerHit');
    expect(types).not.toContain('Miss');
    expect(types).not.toContain('CivilianHit');

    // 11 grunts + 2 runners at 1 hit, 2 heavies at 3 hits = 19 straight body hits.
    const hits = events.filter((e) => e.event.type === 'EnemyHit');
    expect(hits).toHaveLength(19);
    expect(hits.every((e) => e.event.type === 'EnemyHit' && e.event.zone === 'body')).toBe(true);

    let expected = 0;
    for (let streak = 0; streak < 19; streak++) expected += t.scoring.body * multiplierFor(streak, t.scoring);
    expect(expected).toBe(13_000);
    expect(game.state.score.score).toBe(13_000);
    expect(game.state.score.multiplier).toBe(5);
    expect(game.state.lives).toBe(t.difficulty.normal.lives);
    expect(events.at(-1)!.event).toEqual({ type: 'StageCleared', score: 13_000 });
  });

  it('clears on every difficulty', () => {
    for (const difficulty of ['easy', 'normal', 'hard'] as const) {
      const game = newGame({ difficulty });
      runClearingBot(game, tuning());
      expect(game.state.phase, difficulty).toBe('stageClear');
    }
  });
});
