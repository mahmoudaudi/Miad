import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  aiStudioProjectHref,
  aiStudioUrlWithoutInvitation,
  analyzeAiStudio,
  buildGenerationContext,
  captureAiStudioComposerSubmission,
  explicitlyRequestsUploadedImages,
  generateAiStudio,
  readAiStudioModelPreference,
  saveAiStudioModelPreference,
  getAiStudioProjectId,
  invitationDesignPreviewUrl,
  isAmbiguousRefinementRequest,
  resolveAiStudioRequestMode,
  refineAiStudio,
  restoreAiStudioComposerSubmission,
  resolveInvitationImageElements,
  resolveStudioSessionTransition,
  withHeroImage,
  type AiStudioModelOption,
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

describe('persistent AI Studio project routing and request mode', () => {
  const projectId = '7f23f331-eaf2-4c23-a148-95bdd7f24a98';

  it('keeps a new project in the initial creation and Smart Question flow', () => {
    expect(resolveAiStudioRequestMode({ invitationId: null, prompt: 'A garden dinner' })).toBe(
      'initial-analysis'
    );
  });

  it('restores an existing invitation from its route as a refinement project', () => {
    const href = aiStudioProjectHref(projectId);
    const route = new URL(href, 'https://miad.test');
    const restoredId = getAiStudioProjectId(route.searchParams);
    expect(restoredId).toBe(projectId);
    expect(
      resolveAiStudioRequestMode({
        invitationId: restoredId,
        prompt: 'Change the colors to navy and gold',
      })
    ).toBe('existing-refinement');
    expect(invitationDesignPreviewUrl(projectId, 4)).toBe(
      `/api/designs/${projectId}/render?version=4`
    );
  });

  it('uses the same persistent project route after leaving and reopening or refreshing', () => {
    const href = aiStudioProjectHref(projectId);
    // A browser reload rehydrates this ID from the URL rather than chat memory.
    const refreshedId = getAiStudioProjectId(new URL(href, 'https://miad.test').searchParams);
    // Following the AI Studio link after navigating away produces the same route.
    const reopenedId = getAiStudioProjectId(
      new URL(aiStudioProjectHref(projectId), 'https://miad.test').searchParams
    );
    expect(refreshedId).toBe(projectId);
    expect(reopenedId).toBe(projectId);
    expect(resolveAiStudioRequestMode({ invitationId: refreshedId, prompt: 'Add RSVP' })).toBe(
      'existing-refinement'
    );
  });

  it.each([
    'Change the colors to navy and gold',
    'Make the hero more elegant',
    'Add RSVP',
    'Add a decorative floral divider',
    'Replace the background image',
    'Make the animations smoother',
  ])('sends a clear refinement directly without Smart Questions: %s', (prompt) => {
    expect(resolveAiStudioRequestMode({ invitationId: projectId, prompt })).toBe(
      'existing-refinement'
    );
  });

  it('sends multiple clear changes directly to refinement', () => {
    const edits = ['Change the colors to navy and gold', 'Add a warm welcome line', 'Make the layout airy'];
    expect(
      edits.map((prompt) => resolveAiStudioRequestMode({ invitationId: projectId, prompt }))
    ).toEqual(['existing-refinement', 'existing-refinement', 'existing-refinement']);
  });

  it('strips a previous account invitationId from the studio URL on identity change', () => {
    // Account B must never inherit Account A's project from the route.
    expect(aiStudioUrlWithoutInvitation('?invitationId=aaa&community=bb')).toBe(
      '/dashboard/invitations/new?community=bb'
    );
    expect(aiStudioUrlWithoutInvitation('invitationId=aaa')).toBe('/dashboard/invitations/new');
    expect(aiStudioUrlWithoutInvitation('')).toBe('/dashboard/invitations/new');
    expect(aiStudioUrlWithoutInvitation('?community=bb')).toBe(
      '/dashboard/invitations/new?community=bb'
    );
    // The remaining route still resolves to no project (empty studio).
    expect(
      getAiStudioProjectId(
        new URL(aiStudioUrlWithoutInvitation('?invitationId=aaa'), 'https://miad.test').searchParams
      )
    ).toBeNull();
  });

  it('binds loaded studio state to the authenticated identity', () => {
    // First observation only records the identity.
    expect(resolveStudioSessionTransition(null, 'user-a')).toBe('init');
    // Same account keeps everything (no disruptive reset on re-render).
    expect(resolveStudioSessionTransition('user-a', 'user-a')).toBe('keep');
    // Account A -> logout -> Account B login must drop all previous state
    // so B never sees A's project, messages, canvas, or publish URL.
    expect(resolveStudioSessionTransition('user-a', 'user-b')).toBe('reset');
  });

  it('allows Smart Questions for an existing project only when the instruction is vague', () => {
    expect(isAmbiguousRefinementRequest('Make it better')).toBe(true);
    expect(resolveAiStudioRequestMode({ invitationId: projectId, prompt: 'Make it better' })).toBe(
      'existing-analysis'
    );
    expect(
      resolveAiStudioRequestMode({
        invitationId: projectId,
        prompt: 'Add RSVP',
        questionFlowActive: true,
      })
    ).toBe('existing-analysis');
  });
});

describe('explicit uploaded image usage', () => {
  it('requires the prompt to refer to a selected/uploaded image', () => {
    expect(explicitlyRequestsUploadedImages('Use this photo for the couple.')).toBe(true);
    expect(
      explicitlyRequestsUploadedImages('Create a wedding invitation for Ahmad and Sara.')
    ).toBe(false);
    expect(explicitlyRequestsUploadedImages('Use beautiful wedding photography.')).toBe(false);
  });
});

describe('AI Studio composer submission lifecycle', () => {
  const images = [
    {
      id: '11111111-1111-4111-8111-111111111111',
      scope: 'pending' as const,
      fileName: 'couple.jpg',
    },
    {
      id: '22222222-2222-4222-8222-222222222222',
      scope: 'invitation' as const,
      fileName: 'venue.jpg',
    },
  ];

  it('keeps the submitted prompt, generation context, and selected image ids off-composer', () => {
    const context = [
      'Original request: Use these photos for Ahmad and Sara.',
      'Smart Question answers: Style: Elegant',
    ].join('\n');
    const submission = captureAiStudioComposerSubmission(
      'Use these photos for Ahmad and Sara.',
      context,
      images
    );

    expect(submission).toMatchObject({
      prompt: 'Use these photos for Ahmad and Sara.',
      generationContext: context,
      selectedImageIds: images.map((image) => image.id),
    });
    expect(submission.images).toEqual(images);
    expect(submission.images).not.toBe(images);
  });

  it('restores the prompt and images after failure and marks backend-claimed images', () => {
    const submission = captureAiStudioComposerSubmission('Use these photos.', 'context', images);
    const restored = restoreAiStudioComposerSubmission(submission, [images[0]!.id]);

    expect(restored.prompt).toBe('Use these photos.');
    expect(restored.images).toEqual([{ ...images[0], scope: 'invitation' }, images[1]]);
  });
});

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
    const next = withHeroImage(spec, 'image://11111111-1111-4111-8111-111111111111');
    expect(next.elements).toHaveLength(1);
    expect(next.elements?.[0]).toMatchObject({
      id: 'pic-1',
      imageUrl: 'image://11111111-1111-4111-8111-111111111111',
    });
  });
});

describe('resolveInvitationImageElements', () => {
  it('maps invitation image references through preview URLs and leaves https alone', () => {
    const spec: InvitationDesignSpecification = {
      ...base,
      elements: [
        {
          id: 'pic-1',
          type: 'image',
          label: 'Pic',
          imageUrl: 'image://11111111-1111-4111-8111-111111111111',
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
    const next = resolveInvitationImageElements(spec, {
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
    const next = resolveInvitationImageElements(spec, {});
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
      modelPreference: 'auto',
      generationId,
    });
  });

  it('forwards an explicitly selected Stitch model for generation', async () => {
    let seen: RequestInit | undefined;
    global.fetch = (async (_url: unknown, init?: RequestInit) => {
      seen = init;
      return new Response(
        JSON.stringify({ event: {}, invitation: {}, design: null, aiError: null }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );
    }) as typeof fetch;

    await generateAiStudio('A garden birthday for Lina', undefined, undefined, 'GEMINI_3_8_FLASH');

    expect(JSON.parse(String(seen?.body))).toMatchObject({
      modelPreference: 'GEMINI_3_8_FLASH',
    });
  });

  it('sends only image ids chosen for an explicit image request', async () => {
    let seen: RequestInit | undefined;
    global.fetch = (async (_url: unknown, init?: RequestInit) => {
      seen = init;
      return new Response(
        JSON.stringify({ event: {}, invitation: {}, design: null, aiError: null }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );
    }) as typeof fetch;
    const imageId = '11111111-1111-4111-8111-111111111111';
    await generateAiStudio('Use this photo for the couple.', undefined, undefined, 'auto', [
      imageId,
    ]);
    expect(JSON.parse(String(seen?.body))).toMatchObject({ imageIds: [imageId] });

    await generateAiStudio('Create a wedding invitation for Ahmad and Sara.');
    expect(JSON.parse(String(seen?.body))).not.toHaveProperty('imageIds');
  });

  it('sends the original request and every Smart Question answer at the generation boundary', async () => {
    let seen: RequestInit | undefined;
    global.fetch = (async (_url: unknown, init?: RequestInit) => {
      seen = init;
      return new Response(
        JSON.stringify({ event: {}, invitation: {}, design: null, aiError: null }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );
    }) as typeof fetch;

    await generateAiStudio(
      buildGenerationContext(
        'Create a wedding invitation for Ahmad and Sara.',
        { eventType: 'Wedding' },
        [
          { questionId: 'style', question: 'Style', value: 'Luxury romantic' },
          { questionId: 'colors', question: 'Colors', value: ['Ivory', 'gold'] },
          { questionId: 'date', question: 'Date', value: 'June 20, 2027' },
        ]
      )
    );

    const finalPrompt = JSON.parse(String(seen?.body)).prompt as string;
    expect(finalPrompt).toContain('Ahmad');
    expect(finalPrompt).toContain('Sara');
    expect(finalPrompt).toContain('Luxury romantic');
    expect(finalPrompt).toContain('Ivory, gold');
    expect(finalPrompt).toContain('June 20, 2027');
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
        modelPreference: 'auto',
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
      modelPreference: 'auto',
    });
  });
});

describe('refineAiStudio', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('keeps the invitation id and generation progress id on the refinement request', async () => {
    let seen: { url: unknown; init?: RequestInit } | undefined;
    const design = { invitationId: 'inv-1', version: 2 };
    global.fetch = (async (url: unknown, init?: RequestInit) => {
      seen = { url, init };
      return new Response(JSON.stringify(design), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;
    const generationId = '22222222-2222-4222-8222-222222222222';

    await expect(
      refineAiStudio({
        invitationId: 'inv-1',
        website: {
          name: 'Garden Dinner',
          description: 'An evening together',
          files: [
            { path: 'index.html', content: '<main>Garden</main>' },
            { path: 'styles.css', content: 'main{color:green}' },
          ],
        },
        prompt: 'Change the colors to navy and gold',
        generationId,
        modelPreference: 'auto',
      })
    ).resolves.toEqual(design);
    expect(String(seen?.url)).toContain('/ai/refine');
    expect(JSON.parse(String(seen?.init?.body))).toMatchObject({
      invitationId: 'inv-1',
      prompt: 'Change the colors to navy and gold',
      generationId,
      modelPreference: 'auto',
    });
    expect(JSON.stringify(seen?.init?.body)).not.toContain('OPENROUTER_API_KEY');
  });
});

describe('AI Studio model preference storage', () => {
  const storage = new Map<string, string>();
  beforeEach(() => {
    storage.clear();
    vi.stubGlobal('window', {
      localStorage: {
        clear: () => storage.clear(),
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, String(value)),
      },
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  const options: AiStudioModelOption[] = [
    {
      id: 'GEMINI_3_8_FLASH',
      name: 'Stitch — Gemini 3.8 Flash',
      description: 'Fast',
      operations: ['generation'],
      tier: 'standard',
      available: true,
    },
    {
      id: 'GEMINI_3_5_FLASH_LITE',
      name: 'Stitch — Gemini 3.5 Flash-Lite',
      description: 'Coding-focused',
      operations: ['generation'],
      tier: 'standard',
      available: false,
    },
  ];

  it('persists an available preference per account and restores it on re-entry', () => {
    expect(saveAiStudioModelPreference('user-1', options[0]!.id, [...options])).toBe(true);
    expect(readAiStudioModelPreference('user-1', [...options])).toBe(options[0]!.id);
    expect(readAiStudioModelPreference('user-2', [...options])).toBe('auto');
  });

  it('falls back to Auto for unavailable or unapproved stored preferences', () => {
    window.localStorage.setItem('ai-studio-model:user-1', options[1]!.id);
    expect(readAiStudioModelPreference('user-1', [...options])).toBe('auto');
    expect(saveAiStudioModelPreference('user-1', 'provider/arbitrary-model', [...options])).toBe(
      false
    );
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

  it('preserves explicit answers even when the analyzer does not merge them into collectedData', () => {
    const context = buildGenerationContext(
      'Create a wedding invitation for Ahmad and Sara.',
      { eventType: 'Wedding' },
      [
        { questionId: 'style', question: 'Style', value: 'Luxury romantic' },
        { questionId: 'colors', question: 'Colors', value: ['Ivory', 'gold'] },
        { questionId: 'date', question: 'Date', value: 'June 20, 2027' },
      ]
    );
    expect(context).toContain('Original request:\nCreate a wedding invitation for Ahmad and Sara.');
    expect(context).toContain('Style: Luxury romantic');
    expect(context).toContain('Colors: Ivory, gold');
    expect(context).toContain('Date: June 20, 2027');
  });
});
