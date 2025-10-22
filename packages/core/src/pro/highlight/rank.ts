import type { FamiliarityMap, PageStats, RankedTerm, RankOptions } from './types';

function normalize(value: number, max: number): number {
  if (!Number.isFinite(value) || max <= 0) return 0;
  const v = value / max;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function rankTerms(
  page: PageStats,
  candidates: string[],
  familiarity: FamiliarityMap = {},
  opts: RankOptions = {}
): RankedTerm[] {
  const alpha = opts.alpha ?? 0.6;
  const beta = opts.beta ?? 0.4;
  const gamma = opts.gamma ?? 0.0; // tags/extra boost reserved

  // compute max frequency for normalization
  let maxFreq = 0;
  for (const [, v] of page.termFreq) if (v > maxFreq) maxFreq = v;

  const results: RankedTerm[] = [];
  for (const w of candidates) {
    const tf = page.termFreq.get(w) || 0;
    if (tf === 0) continue; // not present on page
    const pageImportance = normalize(tf, maxFreq);
    const fam = familiarity[w] ?? 0; // default unknown
    const unfamiliarity = 1 - Math.max(0, Math.min(1, fam));
    const tagsBoost = 0; // reserved
    const score = alpha * pageImportance + beta * unfamiliarity + gamma * tagsBoost;
    results.push({ word: w, pageImportance, unfamiliarity, tagsBoost, score });
  }

  results.sort((a, b) => b.score - a.score);
  if (opts.topN && results.length > opts.topN) return results.slice(0, opts.topN);
  return results;
}
