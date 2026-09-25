import { describe, expect, it } from 'vitest';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  formatPercent,
  formatTime,
} from './format';

const NOON_UTC = '2026-09-23T12:00:00.000Z';

describe('locale-aware formatting', () => {
  it('formats dates per locale in UTC', () => {
    const en = formatDate(NOON_UTC, 'en', { timeZone: 'UTC' });
    expect(en).toContain('2026');
  });

  it('formats times per locale', () => {
    const opts = { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' } as const;
    const en = formatTime(NOON_UTC, 'en', opts);
    expect(en).toMatch(/12/);
  });

  it('formats datetimes and degrades safely on invalid input', () => {
    expect(formatDateTime(NOON_UTC, 'en', { timeZone: 'UTC' }).length).toBeGreaterThan(0);
    expect(formatDateTime('not-a-date', 'en')).toBe('');
  });

  it('formats numbers, percents, and currency in English', () => {
    expect(formatNumber(1234567, 'en')).toBe('1,234,567');
    expect(formatPercent(0.98, 'en')).toContain('98');
    expect(formatCurrency(29, 'en', 'USD')).toContain('$29');
  });
});
