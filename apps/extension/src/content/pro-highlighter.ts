/*
  Pro Highlighter (scaffold)
  - This module is intentionally not imported by the shipping content script
    to avoid modifying 1.9.9 behavior.
  - It exposes `initProHighlighter` which can be wired in 2.0.0 behind a flag.
*/
import { buildPageStats, rankTerms } from '@core';

type Density = 'low' | 'medium' | 'high';
type Theme = 'gold' | 'underline' | 'blue' | 'high-contrast';
type FamiliarityMap = { [word: string]: number };

const EXCLUDE_SELECTOR = 'script,style,code,pre,textarea,input,select,button,[contenteditable],.cv-pro-hl';

function collectVisibleText(root: Document | HTMLElement): string {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node: Node) {
      if (!node || !node.parentElement) return NodeFilter.FILTER_REJECT;
      const el = node.parentElement as HTMLElement;
      if (el.closest(EXCLUDE_SELECTOR)) return NodeFilter.FILTER_REJECT;
      const text = node.textContent || '';
      if (text.trim().length < 2) return NodeFilter.FILTER_REJECT;
      const style = (el.ownerDocument?.defaultView?.getComputedStyle(el));
      if (style && (style.visibility === 'hidden' || style.display === 'none')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  } as unknown as NodeFilter);
  const parts: string[] = [];
  let n: Node | null;
  while ((n = walker.nextNode())) {
    parts.push(n.textContent || '');
  }
  return parts.join(' ');
}

function chooseTopN(len: number, density: Density): number {
  if (density === 'high') return Math.min(120, Math.max(10, Math.floor(len * 0.06)));
  if (density === 'medium') return Math.min(80, Math.max(8, Math.floor(len * 0.03)));
  return Math.min(50, Math.max(5, Math.floor(len * 0.015)));
}

function ensureStyleInjected(doc: Document): void {
  if (doc.getElementById('cv-pro-hl-style')) return;
  const style = doc.createElement('style');
  style.id = 'cv-pro-hl-style';
  style.textContent = `
  .cv-pro-hl{ border-radius: 3px; padding: 0 2px;}
  .cv-pro-hl.t-gold{ background: rgba(250,204,21,0.35);} .cv-pro-hl.t-gold.lv2{ background: rgba(250,204,21,0.5);} .cv-pro-hl.t-gold.lv3{ background: rgba(250,204,21,0.7);} .cv-pro-hl.t-gold:hover{ outline: 1px solid rgba(250,204,21,0.9);}
  .cv-pro-hl.t-underline{ background: transparent; border-bottom: 2px dotted rgba(250,204,21,0.8);} .cv-pro-hl.t-underline.lv2{ border-bottom-style: solid;} .cv-pro-hl.t-underline.lv3{ border-bottom: 2px solid rgba(250,204,21,1);} .cv-pro-hl.t-underline:hover{ outline: 1px dashed rgba(250,204,21,0.6);}
  .cv-pro-hl.t-blue{ background: rgba(96,165,250,0.35);} .cv-pro-hl.t-blue.lv2{ background: rgba(96,165,250,0.5);} .cv-pro-hl.t-blue.lv3{ background: rgba(96,165,250,0.7);} .cv-pro-hl.t-blue:hover{ outline: 1px solid rgba(96,165,250,0.9);}
  .cv-pro-hl.t-high-contrast{ background: #000; color: #fff; } .cv-pro-hl.t-high-contrast.lv2{ background:#111;} .cv-pro-hl.t-high-contrast.lv3{ background:#222; box-shadow:0 0 0 2px #fff inset;}
  `;
  doc.head.appendChild(style);
}

export interface HighlighterOptions {
  density?: Density;
  observeMutations?: boolean; // if true, observe new nodes and re-apply selectively
  maxHighlights?: number;
  theme?: Theme;
}

export async function initProHighlighter(getUserWords: () => Promise<string[]>, getFamiliarity: () => Promise<FamiliarityMap>, opts: HighlighterOptions = {}): Promise<void> {
  const density = opts.density ?? 'low';
  const theme: Theme = opts.theme ?? 'gold';
  const doc = document;
  ensureStyleInjected(doc);
  const text = collectVisibleText(doc);
  const page = buildPageStats(text);
  const words = (await getUserWords()).map(w => w.toLowerCase());
  const fam = await getFamiliarity();
  const cap = Math.max(10, Math.min(400, opts.maxHighlights ?? 60));
  const topN = Math.min(chooseTopN(page.totalTerms, density), cap);
  const ranked = rankTerms(page, words, fam, { topN });

  const set = new Set(ranked.map(r => r.word));

  // Highlight pass: walk text nodes and wrap matches
  const walker = document.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const parent = (node as Text).parentElement as HTMLElement | null;
    if (!parent || parent.closest(EXCLUDE_SELECTOR)) continue;
    const raw = node.nodeValue || '';
    // quick containment check
    const lower = raw.toLowerCase();
    if (![...set].some(w => lower.includes(w))) continue;

    const frag = doc.createDocumentFragment();
    let i = 0;
    while (i < raw.length) {
      let matched: { word: string; start: number; end: number } | null = null;
      for (const w of set) {
        const idx = raw.toLowerCase().indexOf(w, i);
        if (idx !== -1 && (matched === null || idx < matched.start)) {
          matched = { word: w, start: idx, end: idx + w.length };
        }
      }
      if (!matched) {
        frag.appendChild(doc.createTextNode(raw.slice(i)));
        break;
      }
      if (matched.start > i) {
        frag.appendChild(doc.createTextNode(raw.slice(i, matched.start)));
      }
      const span = doc.createElement('span');
      span.className = `cv-pro-hl t-${theme}`;
      const term = ranked.find(r => r.word === matched!.word);
      if (term) {
        if (term.score > 0.75) span.classList.add('lv3');
        else if (term.score > 0.5) span.classList.add('lv2');
      }
      span.textContent = raw.slice(matched.start, matched.end);
      frag.appendChild(span);
      i = matched.end;
    }
    parent.replaceChild(frag, node);
  }

  // Dispatch a summary event for future UI hooks (2.0.0)
  try {
    const detail = { highlighted: set.size, totalTerms: page.totalTerms };
    window.dispatchEvent(new CustomEvent('checkvoca:pro-highlighted', { detail }));
  } catch { /* ignore */ }

  if (opts.observeMutations) {
    try {
      const obs = new MutationObserver(() => {
        // For simplicity, re-run lightly with low density on dynamic updates.
        // A smarter incremental approach can be added in 2.0.0.
        initProHighlighter(getUserWords, getFamiliarity, { density, observeMutations: false })
          .catch(() => void 0);
      });
      obs.observe(doc.body, { childList: true, subtree: true, characterData: true });
    } catch { /* ignore */ }
  }
}

export function clearProHighlights(root: Document | HTMLElement = document): void {
  const doc = root instanceof Document ? root : root.ownerDocument || document;
  const nodes = (root as HTMLElement).querySelectorAll?.('.cv-pro-hl');
  if (!nodes) return;
  nodes.forEach((span) => {
    const parent = span.parentNode;
    if (!parent) return;
    parent.replaceChild(doc.createTextNode((span as HTMLElement).textContent || ''), span);
    parent.normalize?.();
  });
}
