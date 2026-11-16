import { describe, expect, it } from 'vitest';
import { multiplierFor } from '../../src/sim/score.ts';
import { newGame, readJson, tuning } from '../helpers.ts';
import { runClearingBot } from './bots.ts';

describe('clearing bot on stage 1', () => {
  it('clears all 9 stops with the exact expected score', () => {
    const t = tuning();
    const game = newGame({ seed: 42 });
    const { events } = runClearingBot(game, t);
    const types = events.map((e) => e.event.type);

    expect(game.state.phase).toBe('stageClear');
    expect(types.filter((x) => x === 'StopReached')).toHaveLength(9);
    expect(types).not.toContain('PlayerHit');
    expect(types).not.toContain('Miss');
    expect(types).not.toContain('CoverHit');
    expect(types).not.toContain('CivilianHit');

    // 23 grunts and 8 runners at 1 hit, 4 heavies at 3 hits = 43 straight body hits.
    const hits = events.filter((e) => e.event.type === 'EnemyHit');
    expect(hits).toHaveLength(43);
    expect(hits.every((e) => e.event.type === 'EnemyHit' && e.event.zone === 'body')).toBe(true);

    let expected = 0;
    for (let streak = 0; streak < 43; streak++) expected += t.scoring.body * multiplierFor(streak, t.scoring);
    expect(expected).toBe(37_000);
    expect(game.state.score.score).toBe(37_000);
    expect(game.state.lives).toBe(t.difficulty.normal.lives);
    expect(events.at(-1)!.event).toEqual({ type: 'StageCleared', score: 37_000 });
  });

  it('clears on every difficulty', () => {
    for (const difficulty of ['easy', 'normal', 'hard'] as const) {
      const game = newGame({ difficulty });
      runClearingBot(game, tuning());
      expect(game.state.phase, difficulty).toBe('stageClear');
    }
  });

  it('runs the full rail: about a minute at the bot reaction time of 0.5 s', () => {
    const game = newGame({ seed: 42 });
    const { steps } = runClearingBot(game, tuning());
    // Travel alone is ~184 m of rail at 4 to 5 m/s; a person takes longer than the bot to clear waves.
    expect(steps).toBe(3586);
    expect(game.state.camera.pathOffset).toBe(176.5);
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
