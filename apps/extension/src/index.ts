/// <reference types="chrome" />
import type { SelectionPayload } from '@core';
import { attachSelectionWatcher } from './content/selection-watcher';
import { SelectionTooltip } from './content/tooltip';
import { setReady, setError, resetState, setDefinitions, setDefinitionError, setPhonetic, setAudioUrl } from './content/state';
import { logBreadcrumb, logError } from './content/logging';

interface BackgroundResponse {
  status?: 'ok' | 'error';
  message?: string;
  definitions?: string[];
  phonetic?: string;
  audioUrl?: string;
}

function sendSelectionToBackground(payload: SelectionPayload): Promise<void> {
  logBreadcrumb({ category: 'selection', message: 'save_requested', data: { word: payload.word } });

  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
    console.debug('[WebVoca] Runtime messaging unavailable, skipping background dispatch.');
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: 'CHECKVOCA_SELECTION', payload }, (response: BackgroundResponse) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (response?.status === 'error') {
        reject(new Error(response.message ?? 'Unknown background error'));
        return;
      }
      resolve();
    });
  });
}

type DefinitionResult = {
  definitions: string[];
  phonetic?: string;
  audioUrl?: string;
};

function lookupDefinition(word: string): Promise<DefinitionResult> {
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
    return Promise.resolve({ definitions: [] });
  }

  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: 'CHECKVOCA_LOOKUP', word }, (response: BackgroundResponse) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (response?.status === 'error') {
        reject(new Error(response.message ?? 'Definition lookup failed'));
        return;
      }
      resolve({
        definitions: response?.definitions ?? [],
        phonetic: response?.phonetic,
        audioUrl: response?.audioUrl,
      });
    });
  });
}

new SelectionTooltip({
  onFavoriteToggle: (payload) => {
    logBreadcrumb({ category: 'selection', message: 'favorite_toggle', data: { word: payload.word, favorite: payload.isFavorite } });
  },
});

attachSelectionWatcher((payload, { rect }) => {
  logBreadcrumb({ category: 'selection', message: 'detected', data: { word: payload.word } });
  setReady(payload, rect);
}, lookupDefinition, async (payload, result) => {
  // 자동 저장: 사전 조회 결과를 합쳐 저장
  const enriched: SelectionPayload = {
    ...payload,
    definitions: result.definitions,
    phonetic: result.phonetic,
    audioUrl: result.audioUrl,
  };
  try {
    await sendSelectionToBackground(enriched);
    logBreadcrumb({ category: 'selection', message: 'auto_save_success', data: { word: payload.word } });
  } catch (error) {
    logError(error, { word: payload.word });
    setError(error instanceof Error ? error.message : 'Failed to save word.');
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    resetState();
  }
});

// Manual search from popup: show tooltip as if a selection happened
try {
  chrome.runtime?.onMessage?.addListener((message: unknown, _sender, sendResponse) => {
    (async () => {
      try {
        const msg = message as { type?: string; word?: string } | undefined;
        if (msg?.type !== 'CHECKVOCA_SEARCH_WORD') return;
        const raw = String(msg.word || '').trim();
        if (!raw) {
          sendResponse?.({ status: 'error', message: 'Empty word' });
          return;
        }
        // Build a lightweight payload (no selection range available)
        const payload: SelectionPayload = {
          word: raw,
          context: '',
          url: window.location.href,
          selectionRange: {
            startContainerPath: 'body[0]',
            startOffset: 0,
            endContainerPath: 'body[0]',
            endOffset: 0,
          },
          timestamp: Date.now(),
          clientMeta: {
            title: document.title,
            language: document.documentElement.lang || navigator.language,
            userAgent: navigator.userAgent,
          },
        };

        // Place tooltip near top-left of the viewport
        const rect = new DOMRect(window.scrollX + 24, window.scrollY + 24, 0, 0);
        setReady(payload, rect);

        // Lookup definitions and enrich + save
        const result = await lookupDefinition(payload.word);
        if (result.definitions.length) {
          setDefinitions(result.definitions);
        } else {
          setDefinitionError('No definition found.');
        }
        setPhonetic(result.phonetic);
        setAudioUrl(result.audioUrl);

        const enriched: SelectionPayload = {
          ...payload,
          definitions: result.definitions,
          phonetic: result.phonetic,
          audioUrl: result.audioUrl,
        };
        await sendSelectionToBackground(enriched);
        sendResponse?.({ status: 'ok' });
      } catch (error) {
        logError(error);
        sendResponse?.({ status: 'error', message: error instanceof Error ? error.message : 'Failed' });
      }
    })();
    return true; // keep channel for async
  });
} catch {
  // ignore listener attach errors
}

// Snapshot handoff: when opened with ?snapshotKey=..., pass snapshot to page via postMessage
try {
  const url = new URL(location.href);
  const key = url.searchParams.get('snapshotKey');
  if (key && chrome?.storage?.local) {
    chrome.storage.local.get(key, (items) => {
      const data = items?.[key];
      if (data) {
        window.postMessage({ type: 'CHECKVOCA_SNAPSHOT', payload: data }, '*');
        chrome.storage.local.remove(key);
      }
      // Clean URL
      const clean = location.pathname + (location.hash || '');
      history.replaceState({}, '', clean);
    });
  }
  // Single selection handoff: ?selectionKey=...
  const selKey = url.searchParams.get('selectionKey');
  if (selKey && chrome?.storage?.local) {
    chrome.storage.local.get(selKey, (items) => {
      const data = items?.[selKey];
      if (data) {
        window.postMessage({ type: 'CHECKVOCA_SELECTION', payload: data }, '*');
        chrome.storage.local.remove(selKey);
      }
      const clean = location.pathname + (location.hash || '');
      history.replaceState({}, '', clean);
    });
  }
} catch {
  // ignore
}
