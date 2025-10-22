/// <reference types="chrome" />
import type { SelectionPayload } from '@core';
import { registerSelection } from '@core';

interface LookupResult {
  definitions: string[];
  phonetic?: string;
  audioUrl?: string;
}

// Sanitize HTML-ish payloads coming from external APIs (never inject raw HTML)
function sanitizeDefinition(input: unknown): string {
  const raw = String(input ?? '');
  // Convert <br> to newlines first
  let text = raw.replace(/<\s*br\s*\/?\s*>/gi, '\n');
  // Strip all tags
  text = text.replace(/<[^>]*>/g, '');
  // Decode common entities
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
  };
  text = text.replace(/&(amp|lt|gt|quot|#39|apos);/g, (m) => entities[m] ?? m);
  // Decode numeric entities (decimal/hex)
  text = text.replace(/&#(x?[0-9a-fA-F]+);/g, (_m, code) => {
    try {
      const value = code.startsWith('x') || code.startsWith('X') ? parseInt(code.slice(1), 16) : parseInt(code, 10);
      return Number.isFinite(value) ? String.fromCharCode(value) : _m;
    } catch {
      return _m;
    }
  });
  // Collapse excessive spaces per line, preserve newlines
  text = text
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0)
    .join('\n');
  return text;
}

// Simple in-memory cache to reduce network calls
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
interface CacheEntry {
  value: LookupResult;
  expiresAt: number;
}
const lookupCache = new Map<string, CacheEntry>();

function getCached(word: string): LookupResult | null {
  const key = word.toLowerCase();
  const entry = lookupCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    lookupCache.delete(key);
    return null;
  }
  return entry.value;
}

function setCached(word: string, value: LookupResult): void {
  const key = word.toLowerCase();
  lookupCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

// Minimal response shapes for external APIs
interface NaverWordItem {
  stems?: { match?: string }[];
  meansCollector?: { means?: { value?: string }[] }[];
  phoneticSymbol?: string;
  pronSymbol?: string;
}
interface NaverResponse {
  searchResultMap?: {
    searchResultListMap?: {
      WORD?: { items?: NaverWordItem[] };
    };
  };
}

interface DictPhonetic { text?: string; audio?: string }
interface DictMeaningDef { definition?: string }
interface DictMeaning { definitions?: DictMeaningDef[] }
interface DictEntry {
  phonetic?: string;
  phonetics?: DictPhonetic[];
  meanings?: DictMeaning[];
}

async function fetchFromNaver(word: string): Promise<LookupResult | null> {
  const url = `https://en.dict.naver.com/api3/enko/search?query=${encodeURIComponent(word)}&m=pc&range=word`;
  try {
    const res = await fetch(url, { credentials: 'omit' });
    if (!res.ok) return null;
    const data = (await res.json()) as unknown as NaverResponse;
    const list = data?.searchResultMap?.searchResultListMap?.WORD?.items ?? [];
    if (!Array.isArray(list) || list.length === 0) return null;

    const item =
      list.find((it: NaverWordItem) => (it?.stems ?? []).some((s) => (s?.match ?? '').toLowerCase() === word.toLowerCase())) ??
      list[0];

    const meansCollectors = item?.meansCollector ?? [];
    const defs: string[] = [];
    for (const mc of meansCollectors) {
      for (const m of mc?.means ?? []) {
        if (m?.value) defs.push(sanitizeDefinition(m.value));
      }
    }

    const phonetic: string | undefined = item?.phoneticSymbol || item?.pronSymbol;
    // Naver may not expose a direct audio url here; leave undefined and let fallback fill it.
    return { definitions: defs, phonetic };
  } catch {
    return null;
  }
}

async function fetchFromDictionaryApi(word: string): Promise<LookupResult | null> {
  const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
  try {
    const res = await fetch(url, { credentials: 'omit' });
    if (!res.ok) return null;
    const arr = (await res.json()) as unknown as DictEntry[];
    if (!Array.isArray(arr) || !arr[0]) return null;
    const entry = arr[0];
    const phonetic: string | undefined = entry.phonetics?.find((p) => p.text)?.text || entry.phonetic;
    const audioUrl: string | undefined = entry.phonetics?.find((p) => p.audio)?.audio;
    const defs: string[] = [];
    for (const m of entry.meanings ?? []) {
      for (const d of m.definitions ?? []) {
        if (d?.definition) defs.push(String(d.definition));
      }
    }
    return { definitions: defs, phonetic, audioUrl };
  } catch {
    return null;
  }
}

async function lookup(word: string): Promise<LookupResult> {
  const cached = getCached(word);
  if (cached) return cached;
  const fromNaver = await fetchFromNaver(word);
  const fromDict = await fetchFromDictionaryApi(word);

  // Prefer Korean definitions from Naver when available; merge phonetic/audio from dictionaryapi.dev
  if (fromNaver && fromNaver.definitions.length) {
    const result = {
      definitions: fromNaver.definitions,
      phonetic: fromNaver.phonetic ?? fromDict?.phonetic,
      audioUrl: fromDict?.audioUrl,
    };
    setCached(word, result);
    return result;
  }
  if (fromDict) {
    setCached(word, fromDict);
    return fromDict;
  }
  const empty = { definitions: [] };
  setCached(word, empty);
  return empty;
}

type InMessage =
  | { type: 'CHECKVOCA_SELECTION'; payload: SelectionPayload }
  | { type: 'CHECKVOCA_LOOKUP'; word: string }
  | { type: 'CHECKVOCA_EXPORT_CSV' }
  | { type: 'CHECKVOCA_AUTH_PING'; origin?: string; hasAuth?: boolean; uid?: string; email?: string }
  | { type: string; [k: string]: unknown };

chrome.runtime?.onMessage?.addListener((message: unknown, _sender, sendResponse) => {
  (async () => {
    try {
      const msg = message as InMessage | undefined;
      if (msg?.type === 'CHECKVOCA_SELECTION') {
        const payload = (msg as { payload: SelectionPayload }).payload;
        await registerSelection(payload);
        sendResponse({ status: 'ok' });
        return;
      }
      if (msg?.type === 'CHECKVOCA_LOOKUP') {
        const word = String((msg as { word?: string }).word || '').trim();
        if (!word) {
          sendResponse({ status: 'error', message: 'Empty word' });
          return;
        }
        const result = await lookup(word);
        sendResponse({ status: 'ok', ...result });
        return;
      }
      if (msg?.type === 'CHECKVOCA_AUTH_PING') {
        try {
          const rec = msg as Record<string, unknown>;
          const hasAuth = Boolean(rec.hasAuth);
          const origin = String(rec.origin || '');
          const uidRaw = rec.uid;
          const emailRaw = rec.email;
          const uid = typeof uidRaw === 'string' ? uidRaw.trim() || undefined : undefined;
          const email = typeof emailRaw === 'string' ? emailRaw.trim() || undefined : undefined;
          // Compare against configured web base
          const base = await new Promise<string>((resolve) => {
            try {
              chrome.storage?.sync?.get({ webBaseUrl: '' }, (items) => resolve(String(items?.webBaseUrl || '')));
            } catch {
              resolve('');
            }
          });
          const expectedOrigin = (() => {
            try { return base ? new URL(base).origin : 'https://checkvocage.web.app'; } catch { return 'https://checkvocage.web.app'; }
          })();
          if (origin === expectedOrigin) {
            try {
              const payload: Record<string, unknown> = { webAuthStatus: hasAuth };
              if (hasAuth) {
                payload.webAuthUid = uid ?? null;
                payload.webAuthEmail = email ?? null;
              } else {
                payload.webAuthUid = null;
                payload.webAuthEmail = null;
              }
              chrome.storage?.local?.set(payload);
            } catch { /* ignore */ }
          }
        } catch { /* ignore */ }
        sendResponse({ status: 'ok' });
        return;
      }
      if (msg?.type === 'CHECKVOCA_EXPORT_CSV') {
        await exportCsvAndDownload();
        sendResponse({ status: 'ok' });
        return;
      }
      sendResponse({ status: 'error', message: 'Unknown message' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unexpected error';
      sendResponse({ status: 'error', message });
    }
  })();
  return true; // keep the message channel open for async
});

function toCsvCell(value: unknown): string {
  const s = String(value ?? '');
  const needsQuote = /[",\n]/.test(s);
  const escaped = s.replace(/"/g, '""');
  return needsQuote ? `"${escaped}"` : escaped;
}

async function exportCsvAndDownload(): Promise<void> {
  const { getDatabase } = await import('@core');
  const db = getDatabase();
  const rows = (await db.wordEntries.orderBy('createdAt').toArray()) as import('@core').WordEntry[];
  const header = ['word', 'context', 'url', 'createdAt', 'sourceTitle', 'language', 'isFavorite', 'note'];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push(
      [
        toCsvCell(r.word),
        toCsvCell(r.context),
        toCsvCell(r.url),
        toCsvCell(new Date(r.createdAt).toISOString()),
        toCsvCell(r.sourceTitle),
        toCsvCell(r.language),
        toCsvCell(r.isFavorite ? '1' : '0'),
        toCsvCell(r.note ?? ''),
      ].join(',')
    );
  }
  const csv = lines.join('\n');
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    await chrome.downloads.download({ url, filename: `checkvoca_words_${Date.now()}.csv`, saveAs: true });
  } finally {
    // The browser will revoke when the worker is terminated; keep explicit cleanup later if needed.
  }
}

