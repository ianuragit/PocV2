import type { HitZone, ScoreState, Tuning } from './types';

type Scoring = Tuning['scoring'];

export function createScore(): ScoreState {
  return { score: 0, streak: 0, multiplier: 1, shots: 0, hits: 0 };
}

/** Multiplier for the next hit: +1 for every `combo_step` straight hits, capped at `combo_cap`. */
export function multiplierFor(streak: number, scoring: Scoring): number {
  return Math.min(scoring.combo_cap, 1 + Math.floor(streak / scoring.combo_step));
}

/** Records a hit on a zone and returns the points awarded. */
export function registerHit(s: ScoreState, zone: HitZone, scoring: Scoring): number {
  const points = scoring[zone] * multiplierFor(s.streak, scoring);
  s.score += points;
  s.hits += 1;
  s.streak += 1;
  s.multiplier = multiplierFor(s.streak, scoring);
  return points;
}

/** A miss, a cover hit or a civilian hit breaks the combo. */
export function breakCombo(s: ScoreState): void {
  s.streak = 0;
  s.multiplier = 1;
}

/** How many bonus-life thresholds a score change crossed. */
export function bonusLivesCrossed(before: number, after: number, thresholds: readonly number[]): number {
  return thresholds.filter((t) => before < t && after >= t).length;
}
