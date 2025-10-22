export interface Token {
  text: string;
  start: number;
  end: number;
}

export interface PageStats {
  termFreq: Map<string, number>; // lowercase word -> count
  totalTerms: number;
}

export interface FamiliarityMap {
  // 0 = completely unknown, 1 = fully mastered
  [word: string]: number;
}

export interface RankedTerm {
  word: string;
  pageImportance: number; // 0..1 normalized
  unfamiliarity: number; // 0..1, 1 means very unfamiliar
  tagsBoost?: number; // optional additional weight
  score: number; // final composite 0..1
}

export interface RankOptions {
  alpha?: number; // weight for page importance
  beta?: number; // weight for unfamiliarity
  gamma?: number; // weight for tag match
  topN?: number; // return top N terms
}
