import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const css = readFileSync(
  fileURLToPath(new URL('../app/globals.css', import.meta.url)),
  'utf8'
);

/** Returns the body of the CSS rule whose selector matches, brace-matched. */
function ruleBody(selector: string, from = 0): string {
  const start = css.indexOf(selector, from);
  if (start === -1) return '';
  const open = css.indexOf('{', start);
  if (open === -1) return '';
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    if (css[i] === '}') depth -= 1;
    if (depth === 0) return css.slice(open + 1, i);
  }
  return '';
}

const lightBlock = ruleBody(':root', css.indexOf(':root'));
const darkBlock = ruleBody('.dark .miad-landing');

function lightValue(property: string): string {
  return (new RegExp(`${property}:\\s*([^;]+);`).exec(lightBlock)?.[1] ?? '').trim();
}

function darkValue(property: string): string {
  return (new RegExp(`${property}:\\s*([^;]+);`).exec(darkBlock)?.[1] ?? '').trim();
}

function channels(value: string): number[] {
  return value.split(/\s+/).map((part) => Number(part) || 0);
}

describe('theme tokens', () => {
  const properties = [
    '--background',
    '--foreground',
    '--primary',
    '--secondary',
    '--border',
    '--surface',
    '--surface-muted',
    '--ink',
    '--muted',
    '--accent',
    '--ai',
    '--success',
    '--warning',
    '--destructive',
    '--error',
    '--primary-hover',
    '--on-primary',
    '--section-alt',
    '--tint-soft',
    '--tint-chip',
    '--tint-sand',
    '--tint-blush',
    '--tint-clay',
    '--nav-glass-border',
  ];

  it('defines every token in both themes', () => {
    for (const property of properties) {
      expect(lightValue(property), `${property} light`).not.toBe('');
      expect(darkValue(property), `${property} dark`).not.toBe('');
    }
  });

  it('inverts surface lightness between themes', () => {
    expect(channels(lightValue('--background'))[0]).toBeGreaterThan(200);
    expect(channels(darkValue('--background'))[0]).toBeLessThan(60);
    expect(channels(lightValue('--ink'))[0]).toBeLessThan(60);
    expect(channels(darkValue('--ink'))[0]).toBeGreaterThan(200);
  });

  it('keeps body text above the 4.5:1 contrast ratio in both themes', () => {
    const luminance = (value: string) => {
      const [r = 0, g = 0, b = 0] = channels(value).map((channel) => {
        const c = channel / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a: string, b: string) => {
      const [hi = 1, lo = 0] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };

    // Primary body copy and secondary copy on the page background.
    expect(ratio(lightValue('--ink'), lightValue('--background'))).toBeGreaterThan(4.5);
    expect(ratio(lightValue('--muted'), lightValue('--background'))).toBeGreaterThan(4.5);
    expect(ratio(darkValue('--ink'), darkValue('--background'))).toBeGreaterThan(4.5);
    expect(ratio(darkValue('--muted'), darkValue('--background'))).toBeGreaterThan(4.5);
  });

  it('keeps the primary button label readable in both themes', () => {
    const luminance = (value: string) => {
      const [r = 0, g = 0, b = 0] = channels(value).map((channel) => {
        const c = channel / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a: string, b: string) => {
      const [hi = 1, lo = 0] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    expect(ratio(lightValue('--on-primary'), lightValue('--primary'))).toBeGreaterThan(4.5);
    expect(ratio(darkValue('--on-primary'), darkValue('--primary'))).toBeGreaterThan(4.5);
  });

  it('scopes the dark palette to the landing page so other surfaces are untouched', () => {
    expect(css).toContain('.dark .miad-landing {');
    // A bare `.dark { }` rule may only carry color-scheme, never palette values.
    const bare = /\.dark \{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(bare).not.toMatch(/--/);
    expect(bare).toContain('color-scheme');
  });

  it('cross-fades the theme rather than snapping', () => {
    expect(css).toContain('transition-property: background-color, border-color, color');
    expect(css).toMatch(/transition-duration:\s*var\(--motion-normal\)/);
  });
});
