export type Density = 'low' | 'medium' | 'high';
export type Theme = 'gold' | 'underline' | 'blue' | 'high-contrast';

export interface ProSettings {
  proHighlightEnabled: boolean;
  proHighlightDensity: Density;
  whitelist?: string[]; // domains to enable
  blacklist?: string[]; // domains to disable
  maxHighlights?: number; // per page cap
  observeMutations?: boolean; // dynamic re-apply on DOM changes
  theme?: Theme; // color/accessibility theme
}

export const DEFAULT_SETTINGS: ProSettings = {
  proHighlightEnabled: false,
  proHighlightDensity: 'low',
  whitelist: [],
  blacklist: [],
  maxHighlights: 60,
  observeMutations: true,
  theme: 'gold',
};

export function isDomainAllowed(hostname: string, s: ProSettings): boolean {
  const host = String(hostname || '').toLowerCase();
  if (!host) return false;
  if (s.blacklist && s.blacklist.some((d) => matchDomain(host, d))) return false;
  if (s.whitelist && s.whitelist.length > 0) return s.whitelist.some((d) => matchDomain(host, d));
  return true; // default allow if no whitelist
}

function matchDomain(host: string, pattern: string): boolean {
  const p = String(pattern || '').toLowerCase().trim();
  if (!p) return false;
  if (p.startsWith('*.')) {
    const bare = p.slice(2);
    return host === bare || host.endsWith(`.${bare}`);
  }
  return host === p;
}
