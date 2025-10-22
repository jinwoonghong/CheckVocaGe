import type { Token } from './types';
import { STOPWORDS } from './stopwords';

const WORD_RE = /[A-Za-z][A-Za-z'-]*/g;

export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  if (!text) return tokens;
  let m: RegExpExecArray | null;
  while ((m = WORD_RE.exec(text)) !== null) {
    const t = m[0];
    const lower = t.toLowerCase();
    if (STOPWORDS.has(lower)) continue;
    tokens.push({ text: lower, start: m.index, end: m.index + t.length });
  }
  return tokens;
}

export function buildPageStats(text: string): { termFreq: Map<string, number>; totalTerms: number } {
  const termFreq = new Map<string, number>();
  const toks = tokenize(text);
  for (const tk of toks) termFreq.set(tk.text, (termFreq.get(tk.text) || 0) + 1);
  const totalTerms = toks.length;
  return { termFreq, totalTerms };
}
