/*
  Pro bootstrap (not executed in 1.9.9)
  You can call `maybeInitProHighlighter()` from 2.0.0 content entry to enable.
*/
import { getDatabase } from '@core';
import { initProHighlighter, clearProHighlights, type HighlighterOptions } from './pro-highlighter';
import { buildFamiliarityMap, isDomainAllowed } from '@core';

type Density = 'low' | 'medium' | 'high';

interface ProSettings {
  proHighlightEnabled: boolean;
  proHighlightDensity: Density;
  observeMutations?: boolean;
  maxHighlights?: number;
  theme?: 'gold' | 'underline' | 'blue' | 'high-contrast';
}

async function loadSettings(): Promise<ProSettings> {
  return new Promise((resolve) => {
    try {
      chrome.storage?.sync?.get(
        { proHighlightEnabled: false, proHighlightDensity: 'low' },
        (items) => resolve({
          proHighlightEnabled: Boolean(items?.proHighlightEnabled),
          proHighlightDensity: (['low','medium','high'] as Density[]).includes(items?.proHighlightDensity)
            ? items.proHighlightDensity as Density
            : 'low',
        }),
      );
    } catch {
      resolve({ proHighlightEnabled: false, proHighlightDensity: 'low' });
    }
  });
}

async function getUserWords(limit = 500): Promise<string[]> {
  const db = getDatabase();
  const rows = await db.wordEntries.orderBy('createdAt').reverse().limit(limit).toArray();
  const uniq = new Set<string>();
  for (const r of rows as Array<{ word?: string }>) {
    const w = String(r.word || '').trim();
    if (w) uniq.add(w.toLowerCase());
  }
  return Array.from(uniq);
}

async function getFamiliarity(): Promise<Record<string, number>> {
  const db = getDatabase();
  const states = await db.reviewStates.toArray();
  // states' id == word id in this repository
  return buildFamiliarityMap(states as any[]);
}

export async function maybeInitProHighlighter(): Promise<void> {
  const settings = await loadSettings();
  if (!settings.proHighlightEnabled) return;
  // Domain filter check
  try {
    const host = location.hostname;
    if (!isDomainAllowed(host, settings)) return;
  } catch { /* ignore and proceed */ }
  const opts: HighlighterOptions = {
    density: settings.proHighlightDensity,
    observeMutations: settings.observeMutations ?? true,
    maxHighlights: settings.maxHighlights ?? 60,
    theme: settings.theme ?? 'gold',
  } as any;
  await initProHighlighter(getUserWords, getFamiliarity, opts);

  // React to runtime settings changes (enable/disable)
  try {
    chrome.storage?.onChanged?.addListener((changes, area) => {
      if (area !== 'sync') return;
      if (Object.prototype.hasOwnProperty.call(changes, 'proHighlightEnabled')) {
        const nv = Boolean(changes.proHighlightEnabled.newValue);
        if (!nv) {
          clearProHighlights(document);
        } else {
          initProHighlighter(getUserWords, getFamiliarity, opts).catch(() => void 0);
        }
      }
    });
  } catch { /* ignore */ }
}
