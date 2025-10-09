import { describe, expect, it } from 'vitest';
import { extractContext } from './context2';

function createRangeWithText(text: string): Range {
  document.body.innerHTML = `<p>${text}</p>`;
  const paragraph = document.querySelector('p');
  if (!paragraph) {
    throw new Error('Paragraph not rendered');
  }
  const range = document.createRange();
  const textNode = paragraph.firstChild as Text;
  const index = text.indexOf('token');
  range.setStart(textNode, index);
  range.setEnd(textNode, index + 'token'.length);
  return range;
}

describe('extractContext', () => {
  it('returns a focused snippet around selection', () => {
    const source = 'First sentence. Second token sentence. Third sentence.';
    const range = createRangeWithText(source.replace('token', 'token'));
    const context = extractContext(range, 'token');
    expect(context).toContain('Second token sentence');
    expect(context).not.toContain('First sentence');
    expect(context).not.toContain('Third sentence');
  });

  it('falls back to selection when context not found', () => {
    document.body.innerHTML = '<p>Standalone word</p>';
    const paragraph = document.querySelector('p');
    const range = document.createRange();
    const textNode = paragraph?.firstChild as Text;
    range.setStart(textNode, 0);
    range.setEnd(textNode, 9);
    const context = extractContext(range, 'Standalone word');
    expect(context).toBe('Standalone word');
  });
});

