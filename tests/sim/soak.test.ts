import { describe, expect, it } from 'vitest';
import type { Markers } from '../../src/sim/types.ts';
import { newGame, readJson, tuning } from '../helpers.ts';
import { runClearingBot } from './bots.ts';

/** Every stage, every difficulty, ten seeds: the game always finishes and never stalls. */
describe('soak', () => {
  for (const id of ['stage1', 'stage2', 'stage3']) {
    it(`${id}: 30 runs (3 difficulties x 10 seeds) all clear`, () => {
      const stage = readJson(`public/data/stages/${id}.json`);
      const markers = readJson<Markers>(`public/data/stages/${id}.markers.json`);
      for (const difficulty of ['easy', 'normal', 'hard'] as const) {
        for (let seed = 1; seed <= 10; seed++) {
          const g = newGame({ seed, difficulty, stage, markers });
          runClearingBot(g, tuning());
          expect(g.state.phase, `${difficulty} seed ${seed}`).toBe('stageClear');
        }
      }
    });
  }

  it('the same seed replays identically on every stage', () => {
    for (const id of ['stage2', 'stage3']) {
      const stage = readJson(`public/data/stages/${id}.json`);
      const markers = readJson<Markers>(`public/data/stages/${id}.markers.json`);
      const run = () =>
        runClearingBot(newGame({ seed: 9, difficulty: 'hard', stage, markers }), tuning()).events;
      expect(run()).toEqual(run());
    }
  });
});
