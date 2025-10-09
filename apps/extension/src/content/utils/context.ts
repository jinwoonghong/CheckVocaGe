import { normalizeWhitespace } from '@core';

const BOUNDARY_CHARS = /[-.!?�???:\u2014\u2013\n]/; // sentence-ish boundaries

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
      if (BOUNDARY_CHARS.test(text[i])) return i + 1;
    }
    return start;
  })();

  const endBound = (() => {
    const end = Math.min(text.length, index + windowSize);
    for (let i = index; i < end; i += 1) {
      if (BOUNDARY_CHARS.test(text[i])) return i + 1;
    }
    return end;
  })();

  let snippet = text.slice(startBound, endBound).trim();
  // ?�거: 게시 ?�각/메�? ?�리?�스 (?? "8??????")
  snippet = snippet.replace(/^\d+\s*(�?�??�간|??�?개월|??\s*??s*[??-]\s*/u, '');
  return snippet;
}

export function extractContext(range: Range, selectionText: string, surrounding = 2): string {
  const anchorElement = findBlockElement(range.commonAncestorContainer);
  if (!anchorElement) return selectionText;

  const blockText = normalizeWhitespace(anchorElement.textContent ?? '');
  if (!blockText) return selectionText;

  const target = normalizeWhitespace(selectionText);
  const lower = blockText.toLowerCase();
  const at = lower.indexOf(target.toLowerCase());
  if (at === -1) return target;

  // ?�택 주�? ?��?�??�라?�스?�여 과한 문맥 ?�출 방�?
  const windowSize = Math.max(60, Math.min(200, 100 * (surrounding + 0.5)));
  const snippet = sliceAroundIndex(blockText, at, windowSize);
  return snippet || target;
}
