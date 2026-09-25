import { describe, expect, it } from 'vitest';
import {
  htmlAttrs,
  isLocale,
  LOCALE_COOKIE,
  parseLocaleCookie,
  resolveLocale,
  serializeLocaleCookie,
  trackingFor,
} from './locales';

describe('locale resolution', () => {
  it('always resolves to English', () => {
    expect(resolveLocale(undefined)).toBe('en');
    expect(resolveLocale(null)).toBe('en');
    expect(resolveLocale('')).toBe('en');
    expect(resolveLocale('fr')).toBe('en');
    expect(resolveLocale('EN')).toBe('en');
    expect(resolveLocale('en')).toBe('en');
    expect(resolveLocale('ar')).toBe('en');
  });

  it('identifies only English as supported', () => {
    expect(isLocale('en')).toBe(true);
    expect(isLocale('ar')).toBe(false);
    expect(isLocale('de')).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });

  it('maps English to LTR document attributes', () => {
    expect(htmlAttrs('en')).toEqual({ lang: 'en', dir: 'ltr' });
    expect(htmlAttrs()).toEqual({ lang: 'en', dir: 'ltr' });
  });

  it('serializes a persistent root cookie', () => {
    const header = serializeLocaleCookie('en');
    expect(header).toContain(`${LOCALE_COOKIE}=en`);
    expect(header).toContain('Path=/');
    expect(header).toContain('Max-Age=');
    expect(header).toContain('SameSite=Lax');
  });

  it('parses the locale cookie as English-only', () => {
    expect(parseLocaleCookie(undefined)).toBeNull();
    expect(parseLocaleCookie('')).toBeNull();
    expect(parseLocaleCookie('locale=en')).toBe('en');
    expect(parseLocaleCookie('other=1; locale=en; x=y')).toBe('en');
    expect(parseLocaleCookie('locale=fr')).toBeNull();
  });

  it('preserves tracking classes for English', () => {
    expect(trackingFor('en', 'tracking-wider')).toBe('tracking-wider');
  });
});
