import { afterEach, describe, expect, it } from 'vitest';
import {
  analyzeAiStudio,
  buildGenerationContext,
  generateAiStudio,
  resolveMediaElements,
  withHeroImage,
} from './ai-studio';
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
          id: 'pic-1',
          type: 'image',
          label: 'Pic',
          x: 0,
          y: 0,
          width: 50,
          height: 50,
          fontSize: 16,
          color: '#241C18',
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
          id: 'pic-1',
          type: 'image',
          label: 'Pic',
          imageUrl: 'media://11111111-1111-4111-8111-111111111111',
          x: 0,
          y: 0,
          width: 50,
          height: 50,
          fontSize: 16,
          color: '#241C18',
        },
        {
          id: 'pic-2',
          type: 'image',
          label: 'Web',
          imageUrl: 'https://example.com/b.jpg',
          x: 0,
          y: 0,
          width: 50,
          height: 50,
          fontSize: 16,
          color: '#241C18',
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
          id: 'pic-1',
          type: 'image',
          label: 'Pic',
          imageUrl: 'media://22222222-2222-4222-8222-222222222222',
          x: 0,
          y: 0,
          width: 50,
          height: 50,
          fontSize: 16,
          color: '#241C18',
        },
      ],
    };
    const next = resolveMediaElements(spec, {});
    expect(next.elements?.[0]?.imageUrl).toBe('media://22222222-2222-4222-8222-222222222222');
  });
});

describe('generateAiStudio', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('forwards the caller abort signal and generation id with no invented timeout', async () => {
    let seen: { url: unknown; init?: RequestInit } | undefined;
    const payload = { event: {}, invitation: {}, design: null, aiError: null };
    global.fetch = (async (url: unknown, init?: RequestInit) => {
      seen = { url, init };
      return new Response(JSON.stringify(payload), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;
    const controller = new AbortController();
    const generationId = '11111111-1111-4111-8111-111111111111';
    await expect(
      generateAiStudio('A garden birthday for Lina', generationId, controller.signal)
    ).resolves.toEqual(payload);
    expect(seen?.init?.method).toBe('POST');
    expect(seen?.init?.signal).toBe(controller.signal);
    expect(JSON.parse(String(seen?.init?.body))).toEqual({
      prompt: 'A garden birthday for Lina',
      generationId,
    });
  });
});

describe('analyzeAiStudio', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('posts the prompt, brief, and answers to the analysis endpoint with an abort signal', async () => {
    const analysis = {
      status: 'QUESTION',
      question: {
        id: 'atmosphere',
        text: 'What kind of atmosphere would you like for the dinner?',
        type: 'single_select',
        options: [
          { label: 'Modern', value: 'Modern' },
          { label: 'Luxury', value: 'Luxury' },
        ],
        allowOther: true,
      },
      collectedData: { eventType: 'Dinner' },
    };
    let seen: { url: unknown; init?: RequestInit } | undefined;
    global.fetch = (async (url: unknown, init?: RequestInit) => {
      seen = { url, init };
      return new Response(JSON.stringify(analysis), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;
    const controller = new AbortController();

    await expect(
      analyzeAiStudio({
        prompt: 'Tech Founder Dinner',
        collectedData: { eventType: 'Dinner' },
        answers: [{ questionId: 'atmosphere', value: 'Modern' }],
        signal: controller.signal,
      })
    ).resolves.toEqual(analysis);

    expect(String(seen?.url)).toContain('/ai/analyze');
    expect(seen?.init?.method).toBe('POST');
    expect(seen?.init?.signal).toBe(controller.signal);
    expect(JSON.parse(String(seen?.init?.body))).toEqual({
      prompt: 'Tech Founder Dinner',
      collectedData: { eventType: 'Dinner' },
      answers: [{ questionId: 'atmosphere', value: 'Modern' }],
    });
  });
});

describe('buildGenerationContext', () => {
  it('keeps the original prompt untouched when nothing was collected', () => {
    expect(buildGenerationContext('Tech Founder Dinner', null)).toBe('Tech Founder Dinner');
    expect(buildGenerationContext('Tech Founder Dinner', {})).toBe('Tech Founder Dinner');
  });

  it('merges the brief into a single context for the existing generator', () => {
    const context = buildGenerationContext('Tech Founder Dinner', {
      eventType: 'Corporate Dinner',
      date: '2026-10-15',
      time: '19:00',
      location: 'Beirut',
      style: 'Modern',
      tone: 'Professional',
    });
    expect(context).toContain('Original request:\nTech Founder Dinner');
    expect(context).toContain('Event type: Corporate Dinner');
    expect(context).toContain('Date: October 15, 2026');
    expect(context).toContain('Time: 19:00');
    expect(context).toContain('Location: Beirut');
    expect(context).toContain('Style: Modern');
    expect(context).toContain('Tone: Professional');
  });

  it('renders list and boolean brief values readably', () => {
    const context = buildGenerationContext('A dinner', {
      names: ['Ahmad', 'Sara'],
      colors: ['Navy', 'Gold'],
      rsvpRequired: true,
    });
    expect(context).toContain('Names: Ahmad, Sara');
    expect(context).toContain('Colors: Navy, Gold');
    expect(context).toContain('RSVP required: Yes');
  });
});
