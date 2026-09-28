import {
  attachExplicitImages,
  HTML_ARTIFACT_LIMITS,
  HtmlArtifactValidationError,
  htmlContentSecurityPolicy,
  renderHtmlDocument,
  sanitizeHtmlArtifact,
} from './html-artifact';

const artifact = {
  format: 'html' as const,
  version: 1 as const,
  title: 'Garden Dinner',
  description: 'An evening among the garden',
  body: '<main class="card"><h1>Garden Dinner</h1></main>',
  css: 'body{margin:0;background:#fff;color:#123}h1{font-size:3rem}',
};

describe('HTML artifact contract', () => {
  it('binds only explicit image references and resolves them at render time', () => {
    const imageId = '11111111-1111-4111-8111-111111111111';
    const secondImageId = '22222222-2222-4222-8222-222222222222';
    const withImage = attachExplicitImages(
      {
        ...artifact,
        body: '<main><img src="https://lh3.googleusercontent.com/aida/original"></main>',
      },
      [
        { id: imageId, fileName: 'couple.jpg' },
        { id: secondImageId, fileName: 'venue.jpg' },
      ]
    );
    const clean = sanitizeHtmlArtifact(withImage);
    expect(clean.body).toContain(`image://${imageId}`);
    expect(clean.body).toContain(`image://${secondImageId}`);
    const document = renderHtmlDocument(
      clean,
      'aB3-_9cD4eF6gH8jK1mN2pQ7rS5tU0vW4xY6z',
      (id) => `/api/designs/inv-1/images/${id}`
    );
    expect(document).toContain(`/api/designs/inv-1/images/${imageId}`);
    expect(document).not.toContain('image://');
    expect(htmlContentSecurityPolicy('aB3-_9cD4eF6gH8jK1mN2pQ7rS5tU0vW4xY6z')).toContain(
      "img-src 'self'"
    );
  });
  it('keeps bounded presentational markup and removes active content', () => {
    const clean = sanitizeHtmlArtifact({
      ...artifact,
      title: ' Garden &amp; Dinner ',
      body: [
        '<main class="card hero" id="invitation" onclick="alert(1)">',
        '<h1 style="color:red">Garden Dinner</h1>',
        '<script>alert(1)</script>',
        '<style>body{display:none}</style>',
        '<a href="javascript:alert(1)">link</a>',
        '<img src="https://tracker.example/pixel">',
        '<svg><script>alert(1)</script></svg>',
        '<form action="https://evil.example">form</form>',
        '</main>',
      ].join(''),
      css: [
        '@import url(https://evil.example/x.css);',
        'body{margin:0;background:url(https://tracker.example/pixel)}',
        'h1{font-size:3rem;color:#123}',
        '.card{behavior:url(evil.htc);display:grid}',
      ].join(''),
    });

    expect(clean.title).toBe('Garden & Dinner');
    expect(clean.body).toContain('<main class="card hero" id="invitation">');
    expect(clean.body).toContain('<h1>Garden Dinner</h1>');
    expect(clean.body).not.toMatch(/script|style|onclick|href|src|<img|<svg|<form/i);
    expect(clean.css).toContain('font-size:3rem');
    expect(clean.css).toContain('display:grid');
    expect(clean.css).not.toMatch(/import|url|behavior|evil|tracker/i);
  });

  it('strips resource-bearing CSS and rejects escaped or style-breaking syntax', () => {
    const clean = sanitizeHtmlArtifact({
      ...artifact,
      css: 'body{background:url(https://tracker.example/pixel);color:#123}',
    });
    expect(clean.css).toBe('body{color:#123}');
    let validationError: unknown;
    try {
      sanitizeHtmlArtifact({
        ...artifact,
        css: 'body{color:\\75rl(https://tracker.example/pixel)}',
      });
    } catch (error) {
      validationError = error;
    }
    expect(validationError).toBeInstanceOf(HtmlArtifactValidationError);
    expect(validationError).toMatchObject({
      field: 'css',
      source: 'css',
      category: 'security',
      rule: 'css-angle-or-backslash',
      contentLength: 'body{color:\\75rl(https://tracker.example/pixel)}'.length,
    });
    expect(() =>
      sanitizeHtmlArtifact({
        ...artifact,
        css: '.card{content:"</style><script>alert(1)</script>"}',
      })
    ).toThrow(HtmlArtifactValidationError);
  });

  it('preserves only approved Stitch HTTPS image references', () => {
    const stitchImage = 'https://lh3.googleusercontent.com/aida/AEtjO1WeddingPhotoReference';
    const clean = sanitizeHtmlArtifact({
      ...artifact,
      body: [
        `<img class="portrait" src="${stitchImage}" alt="Sarah and Ahmad" width="1200" height="800" loading="lazy" onerror="alert(1)">`,
        '<img src="https://lh3.googleusercontent.com/not-stitch/image.jpg" alt="wrong path">',
        '<img src="https://googleusercontent.com/aida/image" alt="wrong host">',
        '<img src="https://lh3.googleusercontent.com.evil.example/aida/image" alt="suffix attack">',
        '<img src="http://lh3.googleusercontent.com/aida/image" alt="insecure">',
        '<img src="javascript:alert(1)" alt="script">',
        '<img src="data:image/png;base64,AAAA" alt="inline">',
      ].join(''),
    });

    expect(clean.body).toContain(`src="${stitchImage}"`);
    expect(clean.body).toContain('alt="Sarah and Ahmad"');
    expect(clean.body).toContain('referrerpolicy="no-referrer"');
    expect(clean.body).not.toMatch(
      /onerror|wrong path|wrong host|suffix attack|insecure|script|inline/i
    );
    expect(clean.body.match(/<img\b/g)).toHaveLength(1);
  });

  it('allows renderable HTML when compatibility sanitization filters all CSS', () => {
    expect(() =>
      sanitizeHtmlArtifact({ ...artifact, css: '@import "https://example.test/theme.css";' })
    ).toThrow(HtmlArtifactValidationError);
    expect(
      sanitizeHtmlArtifact(
        { ...artifact, css: '@import "https://example.test/theme.css";' },
        { allowEmptyCssOutput: true }
      )
    ).toMatchObject({ body: artifact.body, css: '' });
    expect(() =>
      sanitizeHtmlArtifact({ ...artifact, css: 'main{color:#123' }, { allowEmptyCssOutput: true })
    ).toThrow(HtmlArtifactValidationError);
  });

  it('retains only bounded provider provenance and never exposes it in rendered HTML', () => {
    const projectId = '641291737810491807';
    const clean = sanitizeHtmlArtifact({
      ...artifact,
      stitch: {
        projectId,
        screenId: '14576dee7bcc4287b4903f2876a0e930',
        modelId: 'GEMINI_3_8_FLASH',
      },
    });
    expect(clean.stitch).toEqual({
      projectId,
      screenId: '14576dee7bcc4287b4903f2876a0e930',
      modelId: 'GEMINI_3_8_FLASH',
    });
    expect(renderHtmlDocument(clean, 'aB3-_9cD4eF6gH8jK1mN2pQ7rS5tU0vW4xY6z')).not.toContain(
      projectId
    );
    expect(
      sanitizeHtmlArtifact({
        ...artifact,
        stitch: { projectId: '../unsafe', screenId: '<script>' },
      }).stitch
    ).toBeUndefined();
  });

  it('enforces artifact field and output bounds', () => {
    expect(() => sanitizeHtmlArtifact({ ...artifact, body: 'x'.repeat(80_001) })).toThrow(
      HtmlArtifactValidationError
    );
    expect(() =>
      sanitizeHtmlArtifact({ ...artifact, title: 'x'.repeat(HTML_ARTIFACT_LIMITS.title + 1) })
    ).toThrow(HtmlArtifactValidationError);
  });

  it('renders a complete escaped document with a nonce-bound restrictive CSP', () => {
    const nonce = 'aB3-_9cD4eF6gH8jK1mN2pQ7rS5tU0vW4xY6z';
    const document = renderHtmlDocument(
      {
        ...artifact,
        title: 'Dinner &amp; Guests',
        description: 'A "private" evening',
        body: '<main><h1>Dinner &amp; Guests</h1><script>alert(1)</script></main>',
        css: 'body{color:#123}',
      },
      nonce
    );
    const policy = htmlContentSecurityPolicy(nonce);

    expect(document).toMatch(/^<!doctype html><html lang="en">/);
    expect(document).toContain('<title>Dinner &amp; Guests</title>');
    expect(document).toContain(`<style nonce="${nonce}">`);
    expect(document).toContain('<main><h1>Dinner &amp; Guests</h1></main>');
    expect(document).not.toContain('<script>');
    expect(policy).toContain("default-src 'none'");
    expect(policy).toContain("script-src 'none'");
    expect(policy).toContain(`style-src 'nonce-${nonce}'`);
    expect(policy).toContain("img-src 'self' https://lh3.googleusercontent.com");
    expect(policy).not.toContain("'unsafe-inline'");
  });
});
