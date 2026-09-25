/**
 * Locale system — English-only for now.
 *
 * Arabic/RTL was removed intentionally. The helpers below are kept as
 * thin compatibility shims so existing `locale` props and
 * `getDictionary(locale)` calls keep working without a large refactor.
 * To re-enable another language later, restore `locales` + dictionaries.
 */

export const locales = ['en'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

/** @deprecated No longer used — kept so old imports don't break. */
export const LOCALE_COOKIE = 'locale';

const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const localeDirections: Record<Locale, 'ltr'> = {
  en: 'ltr',
};

export const localeNames: Record<Locale, string> = {
  en: 'English',
};

export function isLocale(value: unknown): value is Locale {
  return value === 'en';
}

/** Always returns 'en' — any stored value falls back. */
export function resolveLocale(_cookieValue?: string | null): Locale {
  return defaultLocale;
}

/** Document attributes for `<html>` — always English LTR. */
export function htmlAttrs(_locale?: Locale): { lang: Locale; dir: 'ltr' } {
  return { lang: 'en', dir: 'ltr' };
}

/** @deprecated Kept for compatibility; locale persistence is disabled. */
export function serializeLocaleCookie(locale: Locale = 'en'): string {
  void locale;
  return `${LOCALE_COOKIE}=en; Path=/; Max-Age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax`;
}

/** @deprecated Always returns 'en' when an English locale cookie exists, else null. */
export function parseLocaleCookie(header: string | undefined | null): Locale | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name?.trim() === LOCALE_COOKIE) {
      return rest.join('=').trim() === 'en' ? 'en' : null;
    }
  }
  return null;
}

/**
 * Kept as a tiny compatibility helper for existing section components.
 */
export function trackingFor(_locale: Locale, ltrClass: string): string {
  return ltrClass;
}
