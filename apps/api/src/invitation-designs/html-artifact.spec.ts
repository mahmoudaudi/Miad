import {
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
    expect(() =>
      sanitizeHtmlArtifact({
        ...artifact,
        css: 'body{color:\\75rl(https://tracker.example/pixel)}',
      })
    ).toThrow(HtmlArtifactValidationError);
    expect(() =>
      sanitizeHtmlArtifact({
        ...artifact,
        css: '.card{content:"</style><script>alert(1)</script>"}',
      })
    ).toThrow(HtmlArtifactValidationError);
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
    expect(policy).not.toContain("'unsafe-inline'");
  });
});
