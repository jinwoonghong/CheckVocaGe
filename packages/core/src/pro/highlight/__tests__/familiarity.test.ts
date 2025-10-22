import { describe, it, expect } from 'vitest';
import { computeFamiliarity, buildFamiliarityMap } from '../familiarity';

describe('familiarity', () => {
  it('computes higher familiarity for higher reps/EF', () => {
    const now = Date.now();
    const low = computeFamiliarity({ id: 'w1', wordId: 'w1', repetitions: 0, easeFactor: 1.3, interval: 0, nextReviewAt: now + 86400000, history: [] } as any, now);
    const high = computeFamiliarity({ id: 'w1', wordId: 'w1', repetitions: 6, easeFactor: 2.3, interval: 10, nextReviewAt: now + 86400000, history: [] } as any, now);
    expect(high).toBeGreaterThan(low);
  });

  it('applies penalty when overdue', () => {
    const now = Date.now();
    const fresh = computeFamiliarity({ id: 'w2', wordId: 'w2', repetitions: 2, easeFactor: 2.0, interval: 3, nextReviewAt: now + 86400000, history: [] } as any, now);
    const overdue = computeFamiliarity({ id: 'w2', wordId: 'w2', repetitions: 2, easeFactor: 2.0, interval: 3, nextReviewAt: now - 7 * 86400000, history: [] } as any, now);
    expect(overdue).toBeLessThan(fresh);
  });

  it('builds familiarity map', () => {
    const now = Date.now();
    const map = buildFamiliarityMap([
      { id: 'a', wordId: 'a', repetitions: 1, easeFactor: 2.0, interval: 1, nextReviewAt: now, history: [] } as any,
      { id: 'b', wordId: 'b', repetitions: 3, easeFactor: 2.2, interval: 5, nextReviewAt: now, history: [] } as any,
    ], now);
    expect(map.a).toBeGreaterThan(0);
    expect(map.b).toBeGreaterThan(map.a);
  });
});

