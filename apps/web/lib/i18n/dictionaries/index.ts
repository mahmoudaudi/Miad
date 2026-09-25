import type { Locale } from '../locales';
import en from './en';

/** Dictionary shape is derived from English (only language for now). */
export type Dictionary = typeof en;

const dictionaries: Record<Locale, Dictionary> = { en };

/** Returns the English dictionary — `locale` arg kept for compatibility. */
export function getDictionary(_locale?: Locale | string): Dictionary {
  return dictionaries.en ?? en;
}
