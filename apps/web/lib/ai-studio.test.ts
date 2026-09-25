import { describe, expect, it } from 'vitest';
import { resolveMediaElements, withHeroImage } from './ai-studio';
import type { InvitationDesignSpecification } from './invitation-designs';

const base: InvitationDesignSpecification = {
  schemaVersion: 1,
  theme: 'classic-ivory',
  content: { eyebrow: 'Hi', title: 'T', dateLine: 'D', venueLine: 'V' },
  colors: { background: '#FFFDF8', surface: '#FFFFFF', text: '#241C18', accent: '#8B7355' },
  typography: { headingFamily: 'Playfair Display', bodyFamily: 'Inter' },
  layout: { alignment: 'center', density: 'airy' },
  sections: [],
  elements: [],
};

describe('withHeroImage', () => {
  it('appends a top-banner photo element when the spec has no image', () => {
    const next = withHeroImage(base, 'https://example.com/a.jpg');
    expect(base.elements).toEqual([]);
    expect(next.elements).toHaveLength(1);
    expect(next.elements?.[0]).toMatchObject({
      id: 'photo-hero',
      type: 'image',
      imageUrl: 'https://example.com/a.jpg',
    });
  });

  it('reuses the first existing image element instead of duplicating', () => {
    const spec: InvitationDesignSpecification = {
      ...base,
      elements: [
        {
          id: 'pic-1', type: 'image', label: 'Pic', x: 0, y: 0,
          width: 50, height: 50, fontSize: 16, color: '#241C18',
        },
      ],
    };
    const next = withHeroImage(spec, 'media://11111111-1111-4111-8111-111111111111');
    expect(next.elements).toHaveLength(1);
    expect(next.elements?.[0]).toMatchObject({
      id: 'pic-1',
      imageUrl: 'media://11111111-1111-4111-8111-111111111111',
    });
  });
});

describe('resolveMediaElements', () => {
  it('maps media references through preview URLs and leaves https alone', () => {
    const spec: InvitationDesignSpecification = {
      ...base,
      elements: [
        {
          id: 'pic-1', type: 'image', label: 'Pic',
          imageUrl: 'media://11111111-1111-4111-8111-111111111111',
          x: 0, y: 0, width: 50, height: 50, fontSize: 16, color: '#241C18',
        },
        {
          id: 'pic-2', type: 'image', label: 'Web',
          imageUrl: 'https://example.com/b.jpg',
          x: 0, y: 0, width: 50, height: 50, fontSize: 16, color: '#241C18',
        },
      ],
    };
    const next = resolveMediaElements(spec, {
      '11111111-1111-4111-8111-111111111111': 'https://signed.example/p',
    });
    expect(next.elements?.[0]?.imageUrl).toBe('https://signed.example/p');
    expect(next.elements?.[1]?.imageUrl).toBe('https://example.com/b.jpg');
  });

  it('keeps unresolvable references for graceful placeholders', () => {
    const spec: InvitationDesignSpecification = {
      ...base,
      elements: [
        {
          id: 'pic-1', type: 'image', label: 'Pic',
          imageUrl: 'media://22222222-2222-4222-8222-222222222222',
          x: 0, y: 0, width: 50, height: 50, fontSize: 16, color: '#241C18',
        },
      ],
    };
    const next = resolveMediaElements(spec, {});
    expect(next.elements?.[0]?.imageUrl).toBe('media://22222222-2222-4222-8222-222222222222');
  });
});
