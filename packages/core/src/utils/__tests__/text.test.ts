import { describe, expect, it } from 'vitest';
import { normalizeWhitespace, toNormalizedWord } from '../text';

describe('text utils', () => {
  it('normalizes whitespace', () => {
    expect(normalizeWhitespace('  hello\nworld\t')).toBe('hello world');
  });

  it('normalizes word to lowercase', () => {
    expect(toNormalizedWord('  WebVoca ')).toBe('webvoca');
  });
});
