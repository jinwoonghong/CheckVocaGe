/// <reference types="chrome" />
import type { SelectionPayload } from '@core';
import { attachSelectionWatcher } from './content/selection-watcher';
import { SelectionTooltip } from './content/tooltip';
import { setReady, setError, resetState } from './content/state';
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
} catch {
  // ignore
}
