import type { Locale } from './locales';
import { defaultLocale } from './locales';

/**
 * English-only formatting built on Intl — no manual date/number math.
 * `locale` args are kept for compatibility but always resolve to 'en'.
 *
  */
function localeTag(_locale?: Locale | string): string {
  return 'en';
}

export function formatDate(
  value: string | number | Date,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }
): string {
  return new Intl.DateTimeFormat(localeTag(locale), options).format(new Date(value));
}

export function formatTime(
  value: string | number | Date,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' }
): string {
  return new Intl.DateTimeFormat(localeTag(locale), options).format(new Date(value));
}

export function formatDateTime(
  value: string | number | Date,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' }
): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(localeTag(locale), options).format(date);
}

export function formatNumber(
  value: number,
  locale: Locale,
  options: Intl.NumberFormatOptions = {}
): string {
  return new Intl.NumberFormat(localeTag(locale), options).format(value);
}

export function formatPercent(
  value: number,
  locale: Locale,
  options: Intl.NumberFormatOptions = {}
): string {
  return new Intl.NumberFormat(localeTag(locale), { style: 'percent', ...options }).format(value);
}

export function formatCurrency(
  value: number,
  locale: Locale,
  currency: string,
  options: Intl.NumberFormatOptions = {}
): string {
  return new Intl.NumberFormat(localeTag(locale), {
    style: 'currency',
    currency,
    ...options,
  }).format(value);
}

export { defaultLocale };
