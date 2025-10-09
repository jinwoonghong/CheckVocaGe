import { normalizeWhitespace } from '@core';

// Sentence-ish boundaries
const BOUNDARY_CHARS = /[.!?，,、;:\u2014\u2013\n-]/u;

function findBlockElement(node: Node | null): HTMLElement | null {
  let current: Node | null = node;
  while (current && current !== document) {
    if (current instanceof HTMLElement) {
      const display = window.getComputedStyle(current).display;
      if (display === 'block' || display === 'list-item' || display === 'table') {
        return current;
      }
    }
    current = current.parentNode;
  }
  return document.body;
}

function sliceAroundIndex(text: string, index: number, windowSize = 120): string {
  const startBound = (() => {
    const start = Math.max(0, index - windowSize);
    for (let i = index; i >= start; i -= 1) {
      const ch = text[i] ?? '';
      if (BOUNDARY_CHARS.test(ch)) return i + 1;
    }
    return start;
  })();

  const endBound = (() => {
    const end = Math.min(text.length, index + windowSize);
    for (let i = index; i < end; i += 1) {
      const ch = text[i] ?? '';
      if (BOUNDARY_CHARS.test(ch)) return i + 1;
    }
    return end;
  })();

  let snippet = text.slice(startBound, endBound).trim();
  // Remove short leading meta like "8일 전 — "
  snippet = snippet.replace(/^.{0,10}(?:\u2014|-)\s*/u, '');
  return snippet;
}

export function extractContext(range: Range, selectionText: string, surrounding = 0): string {
  const anchorElement = findBlockElement(range.commonAncestorContainer);
  if (!anchorElement) return selectionText;

  const blockText = normalizeWhitespace(anchorElement.textContent ?? '');
  if (!blockText) return selectionText;

  const target = normalizeWhitespace(selectionText);
  const lower = blockText.toLowerCase();
  const at = lower.indexOf(target.toLowerCase());
  if (at === -1) return target;

  const windowSize = Math.max(60, Math.min(200, 100 * (surrounding + 0.5)));
  const snippet = sliceAroundIndex(blockText, at, windowSize);
  return snippet || target;
}

