import { describe, expect, it } from 'vitest';
import { getDictionary, type Dictionary } from './dictionaries/index';

function leaves(value: unknown, path: string[] = []): { path: string; value: unknown }[] {
  if (typeof value === 'string') return [{ path: path.join('.'), value }];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => leaves(item, [...path, String(index)]));
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) =>
      leaves(item, [...path, key])
    );
  }
  return [{ path: path.join('.'), value }];
}

function getAt(dict: Dictionary, path: string): unknown {
  return path.split('.').reduce<unknown>((node, key) => {
    if (Array.isArray(node)) return node[Number(key)];
    if (node !== null && typeof node === 'object') {
      return (node as Record<string, unknown>)[key];
    }
    return undefined;
  }, dict);
}

describe('dictionaries', () => {
  it('keeps the English dictionary populated', () => {
    const enLeaves = leaves(getDictionary('en'));
    expect(enLeaves.length).toBeGreaterThan(50);
  });

  it('returns English for any locale input (English-only mode)', () => {
    expect(getAt(getDictionary('ar' as never), 'nav.pricing')).toBe('Pricing');
    expect(getAt(getDictionary('en'), 'auth.login')).toBe('Log in');
  });

  it('has no empty translations', () => {
    for (const leaf of leaves(getDictionary('en'))) {
      expect(['string', 'boolean'].includes(typeof leaf.value), `en.${leaf.path}`).toBe(true);
      if (typeof leaf.value === 'string') {
        expect(leaf.value.trim().length, `en.${leaf.path}`).toBeGreaterThan(0);
      }
    }
  });

  it('falls back to English for unknown locales', () => {
    expect(getAt(getDictionary('fr' as never), 'nav.templates')).toBe('Templates');
  });
});
