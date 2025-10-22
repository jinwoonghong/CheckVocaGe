import { describe, it, expect } from 'vitest';
import { isDomainAllowed, type ProSettings } from '../../settings';

describe('settings domain filters', () => {
  it('allows by default when no whitelist', () => {
    const s: ProSettings = { proHighlightEnabled: true, proHighlightDensity: 'low' };
    expect(isDomainAllowed('example.com', s)).toBe(true);
  });
  it('blocks blacklist', () => {
    const s: ProSettings = { proHighlightEnabled: true, proHighlightDensity: 'low', blacklist: ['bad.com'] };
    expect(isDomainAllowed('bad.com', s)).toBe(false);
  });
  it('supports wildcard subdomains', () => {
    const s: ProSettings = { proHighlightEnabled: true, proHighlightDensity: 'low', whitelist: ['*.example.com'] };
    expect(isDomainAllowed('a.example.com', s)).toBe(true);
    expect(isDomainAllowed('example.com', s)).toBe(true);
    expect(isDomainAllowed('other.com', s)).toBe(false);
  });
});

