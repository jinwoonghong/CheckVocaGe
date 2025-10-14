import type { SelectionPayload } from '@core';
import { createSelectionRangeSnapshot } from './utils/range';
import { extractContext } from './utils/context2';
import { normalizeWhitespace } from '@core';
import { setDefinitions, setDefinitionError, setPhonetic, setAudioUrl } from './state';

const MIN_LENGTH = 1;
const MAX_LENGTH = 120;
const RECENT_TTL_MS = 5_000;

interface RecentSelection {
  signature: string;
  timestamp: number;
}

const recentSelections: RecentSelection[] = [];

function isDuplicate(signature: string, now: number): boolean {
  const cutoff = now - RECENT_TTL_MS;
  while (recentSelections.length && recentSelections[0].timestamp < cutoff) {
    recentSelections.shift();
  }
  const exists = recentSelections.some((entry) => entry.signature === signature);
  if (!exists) {
    recentSelections.push({ signature, timestamp: now });
  }
  return exists;
}

function buildPayload(selection: Selection): { payload: SelectionPayload; rect: DOMRect | null } | null {
  if (!selection.rangeCount) return null;
  const rawText = selection.toString();
  const word = normalizeWhitespace(rawText);
  if (word.length < MIN_LENGTH || word.length > MAX_LENGTH) return null;

  const range = selection.getRangeAt(0);
  if (!range) return null;
  // 컨텍스트는 선택된 문장만 추출(주변 문장 제외)
  const context = extractContext(range, word, 0);
  if (!context) return null;

  const selectionRange = createSelectionRangeSnapshot(range);
  const rect = range.getBoundingClientRect();

  return {
    payload: {
      word,
      context,
      selectionRange,
      url: window.location.href,
      timestamp: Date.now(),
      clientMeta: {
        title: document.title,
        language: document.documentElement.lang || navigator.language,
        userAgent: navigator.userAgent,
      },
    },
    rect,
  };
}

export interface DefinitionResult {
  definitions: string[];
  phonetic?: string;
  audioUrl?: string;
}

type ActivationModifier = 'any' | 'ctrl' | 'alt' | 'shift' | 'ctrl_shift' | 'alt_shift';

let activationModifier: ActivationModifier = 'any';

function loadActivationModifier(): void {
  try {
    const storage = (chrome as any)?.storage?.sync ?? (chrome as any)?.storage?.local;
    storage?.get?.({ activationModifier: 'any' }, (items: any) => {
      const v = String(items?.activationModifier || 'any');
      activationModifier = (['any','ctrl','alt','shift','ctrl_shift','alt_shift'] as string[]).includes(v) ? (v as ActivationModifier) : 'any';
    });
    (chrome as any)?.storage?.onChanged?.addListener?.((changes: any, area: string) => {
      if ((area === 'sync' || area === 'local') && changes?.activationModifier) {
        const nv = String(changes.activationModifier.newValue || 'any');
        activationModifier = (['any','ctrl','alt','shift','ctrl_shift','alt_shift'] as string[]).includes(nv) ? (nv as ActivationModifier) : 'any';
      }
    });
  } catch {
    activationModifier = 'any';
  }
}

function modifiersMatch(ev?: MouseEvent | KeyboardEvent): boolean {
  const needCtrl = activationModifier === 'ctrl' || activationModifier === 'ctrl_shift';
  const needAlt = activationModifier === 'alt' || activationModifier === 'alt_shift';
  const needShift = activationModifier === 'shift' || activationModifier === 'ctrl_shift' || activationModifier === 'alt_shift';
  if (activationModifier === 'any') return true;
  if (!ev) return false;
  const okCtrl = !needCtrl || !!(ev as any).ctrlKey;
  const okAlt = !needAlt || !!(ev as any).altKey;
  const okShift = !needShift || !!(ev as any).shiftKey;
  return okCtrl && okAlt && okShift;
}

export function attachSelectionWatcher(
  callback: (payload: SelectionPayload, metadata: { rect: DOMRect | null }) => void,
  lookupDefinition: (word: string) => Promise<DefinitionResult>,
  onResult?: (payload: SelectionPayload, result: DefinitionResult) => void,
): void {
  loadActivationModifier();

  const handler = (ev?: MouseEvent | KeyboardEvent) => {
    if (!modifiersMatch(ev)) return;
    const selection = window.getSelection();
    if (!selection) return;
    const result = buildPayload(selection);
    if (!result) return;

    const { payload, rect } = result;
    const signature = `${payload.url}::${payload.word}`;
    if (isDuplicate(signature, payload.timestamp)) return;

    callback(payload, { rect });
    lookupDefinition(payload.word)
      .then((result) => {
        if (result.definitions.length) {
          setDefinitions(result.definitions);
        } else {
          setDefinitionError('No definition found.');
        }
        setPhonetic(result.phonetic);
        setAudioUrl(result.audioUrl);
        onResult?.(payload, result);
      })
      .catch(() => {
        setDefinitionError('Failed to load definition.');
      });
  };

  document.addEventListener('dblclick', (ev) => handler(ev));
  document.addEventListener('mouseup', (event) => {
    if (event.button === 0) handler(event);
  });
  document.addEventListener('keyup', (event) => {
    if (event.key === 'Shift' || event.key.startsWith('Arrow')) {
      handler(event);
    }
  });
}
