import React from 'react';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ShootingStars } from '@/components/landing/ShootingStars';
import { TemplateGridSkeleton } from '@/components/landing/TemplateGridSkeleton';

const css = readFileSync(
  fileURLToPath(new URL('./ShootingStars.module.css', import.meta.url)),
  'utf8'
);

describe('ShootingStars markup', () => {
  const html = renderToStaticMarkup(<ShootingStars />);

  it('is decorative and invisible to assistive technology', () => {
    expect(html).toContain('aria-hidden="true"');
  });

  it('renders an ambient field plus meteors, each with a trailing head', () => {
    const twinkles = (html.match(/--twinkle-duration/g) ?? []).length;
    // --length only marks the meteor body; the head carries no trail.
    const bodies = (html.match(/--length:/g) ?? []).length;
    // Both body and head animate the same travel so they stay in lockstep.
    const travel = (html.match(/--travel:/g) ?? []).length;
    expect(twinkles).toBe(12);
    expect(bodies).toBe(5);
    expect(travel).toBe(bodies * 2);
  });

  it('gives every meteor its own duration and start offset', () => {
    const delays = [...html.matchAll(/--delay:\s*([^;"]+)/g)].map((m) => (m[1] ?? '').trim());
    expect(delays).toHaveLength(10);
    expect(new Set(delays).size).toBe(5);
    // Negative offsets keep the field from ever pulsing in unison.
    expect(delays.every((delay) => delay.startsWith('-'))).toBe(true);
  });

  it('varies star sizes so the field is not uniform', () => {
    const sizes = [...html.matchAll(/width:(\d+(?:\.\d+)?)px/g)].map((m) => m[1] ?? '');
    expect(new Set(sizes).size).toBeGreaterThan(1);
  });

  it('renders deterministically so hydration never mismatches', () => {
    expect(renderToStaticMarkup(<ShootingStars />)).toBe(html);
  });

  it('excludes itself from the theme cross-fade', () => {
    expect(html).toContain('data-shooting-star');
  });
});

describe('ShootingStars animation contract', () => {
  it('never intercepts pointer input', () => {
    expect(css).toMatch(/pointer-events:\s*none/);
  });

  it('contains paint and layout so it cannot shift the hero', () => {
    expect(css).toMatch(/contain:\s*strict/);
    expect(css).toMatch(/position:\s*absolute/);
  });

  it('animates only compositor-friendly properties', () => {
    // Animating layout or paint properties would force work on every frame.
    const keyframes = css.slice(css.indexOf('@keyframes'));
    const forbidden = /:\s*(width|height|top|left|right|bottom|margin|padding|box-shadow|background|filter|opacity-scaling)\b/;
    expect(keyframes).not.toMatch(forbidden);
    // And it does animate something.
    expect(keyframes).toMatch(/(opacity|transform):/);
  });

  it('stops animating under prefers-reduced-motion', () => {
    const block = /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*$/.exec(css)?.[0] ?? '';
    expect(block).toContain('animation: none');
    expect(block).toContain('.star');
    expect(block).toContain('.shooting');
  });
});

describe('TemplateGridSkeleton', () => {
  const html = renderToStaticMarkup(<TemplateGridSkeleton loadingLabel="Loading templates" />);

  it('announces busy state with an accessible label', () => {
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('Loading templates');
  });

  it('reserves the same slot count as the real grid', () => {
    expect((html.match(/aspect-\[4\/3\]/g) ?? []).length).toBe(8);
  });

  it('uses theme tokens rather than fixed light hexes', () => {
    expect(html).not.toMatch(/#e8e4de|#eeeeec/);
    expect(html).toContain('border-line');
  });

  it('hides decorative shapes from assistive technology', () => {
    expect(html).toContain('aria-hidden="true"');
  });
});
