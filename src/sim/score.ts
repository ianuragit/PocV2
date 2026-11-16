import type { HitZone, Rank, ScoreState, StageDef, Tuning } from './types.ts';

type Scoring = Tuning['scoring'];

export function createScore(): ScoreState {
  return { score: 0, streak: 0, multiplier: 1, shots: 0, hits: 0, shotsOnTarget: 0 };
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

/** Rank for a final score against a stage's thresholds; below B is C. */
export function rankFor(score: number, thresholds: StageDef['rank_thresholds']): Rank {
  return score >= thresholds.S ? 'S' : score >= thresholds.A ? 'A' : score >= thresholds.B ? 'B' : 'C';
}

/** Percent of shots that hit at least one target, rounded. */
export function accuracy(s: ScoreState): number {
  return s.shots === 0 ? 0 : Math.round((s.shotsOnTarget / s.shots) * 100);
}
