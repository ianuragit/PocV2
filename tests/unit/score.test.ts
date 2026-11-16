import { describe, expect, it } from 'vitest';
import {
  bonusLivesCrossed,
  breakCombo,
  createScore,
  multiplierFor,
  registerHit,
} from '../../src/sim/score.ts';
import { tuning } from '../helpers.ts';

const scoring = tuning().scoring;

describe('score', () => {
  it('pays each zone its base points at x1', () => {
    for (const [zone, points] of [
      ['gun_hand', 500],
      ['head', 300],
      ['body', 200],
    ] as const) {
      const s = createScore();
      expect(registerHit(s, zone, scoring)).toBe(points);
      expect(s.score).toBe(points);
    }
  });

  it('adds +1 to the multiplier every 3 straight hits', () => {
    const s = createScore();
    const awarded = Array.from({ length: 7 }, () => registerHit(s, 'body', scoring));
    expect(awarded).toEqual([200, 200, 200, 400, 400, 400, 600]);
    expect(s.multiplier).toBe(3);
    expect(s.hits).toBe(7);
  });

  it('caps the multiplier at x5', () => {
    expect(multiplierFor(12, scoring)).toBe(5);
    expect(multiplierFor(300, scoring)).toBe(5);
    const s = createScore();
    for (let i = 0; i < 20; i++) registerHit(s, 'head', scoring);
    expect(registerHit(s, 'head', scoring)).toBe(1500);
  });

  it('resets the combo on a miss', () => {
    const s = createScore();
    for (let i = 0; i < 4; i++) registerHit(s, 'body', scoring);
    expect(s.multiplier).toBe(2);
    breakCombo(s);
    expect(s.streak).toBe(0);
    expect(s.multiplier).toBe(1);
    expect(registerHit(s, 'body', scoring)).toBe(200);
  });

  it('counts bonus-life thresholds crossed at 50,000 and 150,000', () => {
    const at = tuning().player.bonus_lives_at;
    expect(bonusLivesCrossed(49_900, 50_000, at)).toBe(1);
    expect(bonusLivesCrossed(50_000, 50_200, at)).toBe(0);
    expect(bonusLivesCrossed(149_000, 151_000, at)).toBe(1);
    expect(bonusLivesCrossed(0, 200_000, at)).toBe(2);
    expect(bonusLivesCrossed(0, 49_999, at)).toBe(0);
  });
});
