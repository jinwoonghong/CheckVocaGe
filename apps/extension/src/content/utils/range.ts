import type { SelectionRangeSnapshot } from '@core';

function nodeIndex(node: Node): number {
  let index = 0;
  let sibling = node.previousSibling;
  while (sibling) {
    if (sibling.nodeName === node.nodeName) {
      index += 1;
    }
    sibling = sibling.previousSibling;
  }
  return index;
}

function describeNode(node: Node | null): string {
  if (!node) return 'null';
  const segments: string[] = [];
  let current: Node | null = node;
  while (current && current !== document) {
    const name = current.nodeType === Node.TEXT_NODE ? '#text' : current.nodeName.toLowerCase();
    segments.push(`${name}[${nodeIndex(current)}]`);
    current = current.parentNode;
  }
  return segments.reverse().join('>');
}

export function createSelectionRangeSnapshot(range: Range): SelectionRangeSnapshot {
  return {
    startContainerPath: describeNode(range.startContainer),
    startOffset: range.startOffset,
    endContainerPath: describeNode(range.endContainer),
    endOffset: range.endOffset,
  };
}

