import { describe, expect, it } from 'vitest';
import { buildPageStats, tokenize } from '../tokenize';
import { rankTerms } from '../rank';

describe('tokenize + rank', () => {
  it('tokenizes english text and filters stopwords', () => {
    const toks = tokenize("The quick brown fox jumps over the lazy dog and the fox.");
    const words = toks.map(t => t.text);
    expect(words).toContain('quick');
    expect(words).toContain('brown');
    expect(words).toContain('fox');
    expect(words).not.toContain('the');
    expect(words).not.toContain('and');
  });

  it('ranks candidate terms using page frequency and unfamiliarity', () => {
    const text = 'machine learning is a field of study that gives computers the ability to learn without being explicitly programmed. machine learning techniques are widely used.';
    const page = buildPageStats(text);
    const candidates = ['machine','learning','programmed','techniques','ability','computers'];
    const familiarity = { machine: 0.2, learning: 0.3, computers: 0.8 };
    const ranked = rankTerms(page, candidates, familiarity, { topN: 3 });
    expect(ranked.length).toBe(3);
    expect(ranked[0].word).toBeTypeOf('string');
    // high frequency + low familiarity should bubble up
    const topWords = ranked.map(r => r.word);
    expect(topWords).toContain('machine');
    expect(topWords).toContain('learning');
  });
});

