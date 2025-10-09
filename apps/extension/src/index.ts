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
  onSave: async (payload) => {
    try {
      await sendSelectionToBackground(payload);
      logBreadcrumb({ category: 'selection', message: 'save_success', data: { word: payload.word } });
    } catch (error) {
      logError(error, { word: payload.word });
      setError(error instanceof Error ? error.message : 'Failed to save word.');
      throw error;
    }
  },
  onFavoriteToggle: (payload) => {
    logBreadcrumb({ category: 'selection', message: 'favorite_toggle', data: { word: payload.word, favorite: payload.isFavorite } });
  },
});

attachSelectionWatcher((payload, { rect }) => {
  logBreadcrumb({ category: 'selection', message: 'detected', data: { word: payload.word } });
  setReady(payload, rect);
}, lookupDefinition);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    resetState();
  }
});
