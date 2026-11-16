import { describe, expect, it } from 'vitest';
import { PROFILES, playLikeAPerson } from '../../tools/tune-report.ts';

const [sharp, average, casual] = PROFILES as [
  (typeof PROFILES)[0],
  (typeof PROFILES)[0],
  (typeof PROFILES)[0],
];

/**
 * Guards on the difficulty curve measured in docs/decisions/0007. They fail if a change makes the
 * game much harder or easier than the agreed baseline, so tuning changes are deliberate.
 */
describe('difficulty curve (human-like bots)', () => {
  it('a sharp player clears every stage on Normal without continues', () => {
    for (const stage of ['stage1', 'stage2', 'stage3']) {
      const r = playLikeAPerson(stage, 'normal', sharp, 1);
      expect(r.cleared && r.continues === 0, stage).toBe(true);
    }
  });

  it('an average player clears stage 1 on Normal but loses lives doing it', () => {
    const r = playLikeAPerson('stage1', 'normal', average, 1);
    expect(r.cleared).toBe(true);
    expect(r.livesLost).toBeGreaterThan(0);
  });

  it('a casual player clears stage 1 on Easy', () => {
    const r = playLikeAPerson('stage1', 'easy', casual, 1);
    expect(r.cleared && r.continues === 0).toBe(true);
  });

  it('Hard is harder than Easy for the same player', () => {
    const easy = playLikeAPerson('stage2', 'easy', average, 2);
    const hard = playLikeAPerson('stage2', 'hard', average, 2);
    expect(hard.livesLost + hard.continues * 5).toBeGreaterThan(easy.livesLost);
  });
});
