import type { ReviewState } from '../../models';
import type { FamiliarityMap } from './types';

function clamp01(n: number): number { return n < 0 ? 0 : n > 1 ? 1 : n; }

export function computeFamiliarity(state: ReviewState, now: number = Date.now()): number {
  // Heuristic: more repetitions and higher EF => more familiar
  const repPart = Math.min(state.repetitions / 8, 1); // up to 8 reps to reach 1.0
  const efPart = (state.easeFactor - 1.3) / (2.5 - 1.3); // EF range ~1.3..2.5
  const base = clamp01(0.6 * repPart + 0.4 * clamp01(efPart));

  // If review is overdue, reduce familiarity
  const overdueDays = (now - state.nextReviewAt) / (24 * 60 * 60 * 1000);
  const penalty = overdueDays > 0 ? Math.min(overdueDays / 14, 0.4) : 0; // cap 0.4
  return clamp01(base * (1 - penalty));
}

export function buildFamiliarityMap(states: ReviewState[], now: number = Date.now()): FamiliarityMap {
  const out: FamiliarityMap = {};
  for (const s of states) {
    out[s.id] = computeFamiliarity(s, now);
  }
  return out;
}

