/// <reference types="chrome" />
import type { Density, ProSettings, Theme } from '@core';
import { DEFAULT_SETTINGS } from '@core';

export async function loadProSettings(): Promise<ProSettings> {
  return new Promise((resolve) => {
    try {
      chrome.storage?.sync?.get(DEFAULT_SETTINGS as unknown as Record<string, unknown>, (items) => {
        const out: ProSettings = {
          proHighlightEnabled: Boolean(items?.proHighlightEnabled),
          proHighlightDensity: (['low','medium','high'] as Density[]).includes(items?.proHighlightDensity)
            ? (items?.proHighlightDensity as Density)
            : 'low',
          whitelist: Array.isArray(items?.whitelist) ? (items?.whitelist as string[]) : [],
          blacklist: Array.isArray(items?.blacklist) ? (items?.blacklist as string[]) : [],
          maxHighlights: Number.isFinite(items?.maxHighlights as number) ? (items?.maxHighlights as number) : DEFAULT_SETTINGS.maxHighlights,
          observeMutations: typeof items?.observeMutations === 'boolean' ? Boolean(items?.observeMutations) : DEFAULT_SETTINGS.observeMutations,
          theme: (['gold','underline','blue','high-contrast'] as Theme[]).includes(items?.theme as Theme) ? (items?.theme as Theme) : DEFAULT_SETTINGS.theme,
        };
        resolve(out);
      });
    } catch {
      resolve(DEFAULT_SETTINGS);
    }
  });
}

export async function saveProSettings(patch: Partial<ProSettings>): Promise<void> {
  return new Promise((resolve) => {
    try { chrome.storage?.sync?.set(patch as unknown as Record<string, unknown>, () => resolve()); } catch { resolve(); }
  });
}
