import postcss, { type AtRule, type Container, type Document, type Rule } from 'postcss';
import sanitizeHtml from 'sanitize-html';

export const HTML_ARTIFACT_FORMAT = 'html' as const;
export const HTML_ARTIFACT_VERSION = 1 as const;
export const HTML_ARTIFACT_LIMITS = {
  title: 120,
  description: 300,
  body: 30_000,
  css: 25_000,
} as const;

const MAX_BODY_INPUT = 80_000;
const MAX_CSS_INPUT = 60_000;
const MAX_CSS_RULES = 500;
const MAX_CSS_DECLARATIONS = 1_500;
const SAFE_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_-]{0,63}$/;
const SAFE_CLASS = /^[A-Za-z_][A-Za-z0-9_-]{0,63}$/;
const HTML_TAGS = [
  'main',
  'section',
  'article',
  'header',
  'footer',
  'div',
  'span',
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'dl',
  'dt',
  'dd',
  'strong',
  'em',
  'small',
  's',
  'blockquote',
  'pre',
  'code',
  'sup',
  'sub',
  'time',
  'br',
  'hr',
  'figure',
  'figcaption',
];
const SAFE_CSS_PROPERTIES = new Set([
  'accent-color',
  'align-content',
  'align-items',
  'align-self',
  'all',
  'animation',
  'animation-delay',
  'animation-direction',
  'animation-duration',
  'animation-fill-mode',
  'animation-iteration-count',
  'animation-name',
  'animation-play-state',
  'animation-timing-function',
  'appearance',
  'aspect-ratio',
  'backdrop-filter',
  'background',
  'background-attachment',
  'background-blend-mode',
  'background-clip',
  'background-color',
  'background-image',
  'background-origin',
  'background-position',
  'background-repeat',
  'background-size',
  'block-size',
  'border',
  'border-block',
  'border-block-color',
  'border-block-end',
  'border-block-end-color',
  'border-block-end-style',
  'border-block-end-width',
  'border-block-start',
  'border-block-start-color',
  'border-block-start-style',
  'border-block-start-width',
  'border-block-style',
  'border-block-width',
  'border-bottom',
  'border-bottom-color',
  'border-bottom-left-radius',
  'border-bottom-right-radius',
  'border-bottom-style',
  'border-bottom-width',
  'border-collapse',
  'border-color',
  'border-end-end-radius',
  'border-end-start-radius',
  'border-inline',
  'border-inline-color',
  'border-inline-end',
  'border-inline-end-color',
  'border-inline-end-style',
  'border-inline-end-width',
  'border-inline-start',
  'border-inline-start-color',
  'border-inline-start-style',
  'border-inline-start-width',
  'border-inline-style',
  'border-inline-width',
  'border-left',
  'border-left-color',
  'border-left-style',
  'border-left-width',
  'border-radius',
  'border-right',
  'border-right-color',
  'border-right-style',
  'border-right-width',
  'border-spacing',
  'border-start-end-radius',
  'border-start-start-radius',
  'border-style',
  'border-top',
  'border-top-color',
  'border-top-left-radius',
  'border-top-right-radius',
  'border-top-style',
  'border-top-width',
  'border-width',
  'bottom',
  'box-shadow',
  'box-sizing',
  'break-after',
  'break-before',
  'break-inside',
  'caption-side',
  'caret-color',
  'clear',
  'clip-path',
  'color',
  'column-count',
  'column-gap',
  'column-rule',
  'column-rule-color',
  'column-rule-style',
  'column-rule-width',
  'column-span',
  'column-width',
  'columns',
  'contain',
  'content',
  'content-visibility',
  'counter-increment',
  'counter-reset',
  'cursor',
  'direction',
  'display',
  'empty-cells',
  'filter',
  'flex',
  'flex-basis',
  'flex-direction',
  'flex-flow',
  'flex-grow',
  'flex-shrink',
  'flex-wrap',
  'float',
  'font',
  'font-family',
  'font-feature-settings',
  'font-kerning',
  'font-size',
  'font-size-adjust',
  'font-stretch',
  'font-style',
  'font-synthesis',
  'font-variant',
  'font-variant-caps',
  'font-variant-numeric',
  'font-weight',
  'gap',
  'grid',
  'grid-area',
  'grid-auto-columns',
  'grid-auto-flow',
  'grid-auto-rows',
  'grid-column',
  'grid-column-end',
  'grid-column-gap',
  'grid-column-start',
  'grid-gap',
  'grid-row',
  'grid-row-end',
  'grid-row-gap',
  'grid-row-start',
  'grid-template',
  'grid-template-areas',
  'grid-template-columns',
  'grid-template-rows',
  'height',
  'hyphens',
  'inline-size',
  'inset',
  'inset-block',
  'inset-block-end',
  'inset-block-start',
  'inset-inline',
  'inset-inline-end',
  'inset-inline-start',
  'isolation',
  'justify-content',
  'justify-items',
  'justify-self',
  'left',
  'letter-spacing',
  'line-break',
  'line-height',
  'list-style',
  'list-style-image',
  'list-style-position',
  'list-style-type',
  'margin',
  'margin-block',
  'margin-block-end',
  'margin-block-start',
  'margin-bottom',
  'margin-inline',
  'margin-inline-end',
  'margin-inline-start',
  'margin-left',
  'margin-right',
  'margin-top',
  'mask',
  'max-block-size',
  'max-height',
  'max-inline-size',
  'max-width',
  'min-block-size',
  'min-height',
  'min-inline-size',
  'min-width',
  'mix-blend-mode',
  'object-fit',
  'object-position',
  'offset',
  'offset-distance',
  'offset-path',
  'offset-rotate',
  'opacity',
  'order',
  'orphans',
  'outline',
  'outline-color',
  'outline-offset',
  'outline-style',
  'outline-width',
  'overflow',
  'overflow-anchor',
  'overflow-wrap',
  'overflow-x',
  'overflow-y',
  'overscroll-behavior',
  'padding',
  'padding-block',
  'padding-block-end',
  'padding-block-start',
  'padding-bottom',
  'padding-inline',
  'padding-inline-end',
  'padding-inline-start',
  'padding-left',
  'padding-right',
  'padding-top',
  'page-break-after',
  'page-break-before',
  'page-break-inside',
  'perspective',
  'perspective-origin',
  'place-content',
  'place-items',
  'place-self',
  'pointer-events',
  'position',
  'quotes',
  'resize',
  'right',
  'rotate',
  'row-gap',
  'scale',
  'scroll-behavior',
  'scroll-margin',
  'scroll-margin-block',
  'scroll-margin-block-end',
  'scroll-margin-block-start',
  'scroll-margin-bottom',
  'scroll-margin-inline',
  'scroll-margin-inline-end',
  'scroll-margin-inline-start',
  'scroll-margin-left',
  'scroll-margin-right',
  'scroll-margin-top',
  'scroll-padding',
  'scroll-padding-block',
  'scroll-padding-block-end',
  'scroll-padding-block-start',
  'scroll-padding-bottom',
  'scroll-padding-inline',
  'scroll-padding-inline-end',
  'scroll-padding-inline-start',
  'scroll-padding-left',
  'scroll-padding-right',
  'scroll-padding-top',
  'scroll-snap-align',
  'scroll-snap-type',
  'scrollbar-color',
  'scrollbar-width',
  'shape-image-threshold',
  'shape-margin',
  'shape-outside',
  'tab-size',
  'table-layout',
  'text-align',
  'text-align-last',
  'text-combine-upright',
  'text-decoration',
  'text-decoration-color',
  'text-decoration-line',
  'text-decoration-style',
  'text-decoration-thickness',
  'text-emphasis',
  'text-emphasis-color',
  'text-emphasis-position',
  'text-emphasis-style',
  'text-indent',
  'text-justify',
  'text-orientation',
  'text-overflow',
  'text-rendering',
  'text-shadow',
  'text-transform',
  'text-underline-offset',
  'text-underline-position',
  'text-wrap',
  'top',
  'touch-action',
  'transform',
  'transform-box',
  'transform-origin',
  'transform-style',
  'transition',
  'transition-delay',
  'transition-duration',
  'transition-property',
  'transition-timing-function',
  'translate',
  'unicode-bidi',
  'user-select',
  'vertical-align',
  'visibility',
  'white-space',
  'widows',
  'width',
  'word-break',
  'word-spacing',
  'word-wrap',
  'writing-mode',
  'z-index',
  'zoom',
  '-webkit-font-smoothing',
  '-webkit-line-clamp',
  '-webkit-text-size-adjust',
  '-webkit-text-stroke',
  '-webkit-text-stroke-color',
  '-webkit-text-stroke-width',
  '-webkit-box-orient',
  '-webkit-box-align',
  '-webkit-line-clamp',
  '-webkit-mask-image',
  '-webkit-mask-size',
  '-webkit-mask-repeat',
  '-webkit-print-color-adjust',
]);
const FORBIDDEN_CSS_VALUE =
  /(?:url\s*\(|image-set\s*\(|cross-fade\s*\(|element\s*\(|attr\s*\(|expression\s*\(|javascript\s*:|vbscript\s*:|data\s*:|https?\s*:|file\s*:|blob\s*:|-moz-binding|behavior\s*:)/i;
const SAFE_SELECTOR = /^[A-Za-z0-9_#.:[\]()>+~*,\-\s]+$/;
const SAFE_AT_RULE_PARAMS = /^[A-Za-z0-9_#.,:()\s+-]+$/;

export type HtmlArtifactEnvelope = {
  format: typeof HTML_ARTIFACT_FORMAT;
  version: typeof HTML_ARTIFACT_VERSION;
  title: string;
  description: string;
  body: string;
  css: string;
};

export type PublicHtmlArtifactMetadata = Pick<
  HtmlArtifactEnvelope,
  'format' | 'version' | 'title' | 'description'
>;

export class HtmlArtifactValidationError extends Error {
  constructor(readonly field: string) {
    super(`Invalid HTML artifact field: ${field}`);
  }
}

export function isHtmlArtifactEnvelope(value: unknown): value is HtmlArtifactEnvelope {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const artifact = value as Partial<HtmlArtifactEnvelope>;
  return artifact.format === HTML_ARTIFACT_FORMAT && artifact.version === HTML_ARTIFACT_VERSION;
}

export function sanitizeHtmlArtifact(value: unknown): HtmlArtifactEnvelope {
  if (!isHtmlArtifactEnvelope(value)) throw new HtmlArtifactValidationError('format');
  const title = plainText(value.title, HTML_ARTIFACT_LIMITS.title, 'title');
  const description = plainText(value.description, HTML_ARTIFACT_LIMITS.description, 'description');
  const body = sanitizeBody(value.body);
  const css = sanitizeCss(value.css);
  return {
    format: HTML_ARTIFACT_FORMAT,
    version: HTML_ARTIFACT_VERSION,
    title,
    description,
    body,
    css,
  };
}

export function toPublicHtmlArtifactMetadata(
  artifact: HtmlArtifactEnvelope
): PublicHtmlArtifactMetadata {
  return {
    format: artifact.format,
    version: artifact.version,
    title: artifact.title,
    description: artifact.description,
  };
}

export function renderHtmlDocument(artifactValue: unknown, nonce: string): string {
  const artifact = sanitizeHtmlArtifact(artifactValue);
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(nonce)) {
    throw new HtmlArtifactValidationError('nonce');
  }
  const description = escapeHtml(artifact.description);
  const title = escapeHtml(artifact.title);
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="description" content="' + description + '">',
    '<meta name="referrer" content="no-referrer">',
    '<title>' + title + '</title>',
    '<style nonce="' + nonce + '">' + artifact.css + '</style>',
    '</head>',
    '<body>' + artifact.body + '</body>',
    '</html>',
  ].join('');
}

export function htmlContentSecurityPolicy(nonce: string): string {
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(nonce)) {
    throw new HtmlArtifactValidationError('nonce');
  }
  return [
    "default-src 'none'",
    "base-uri 'none'",
    "object-src 'none'",
    "script-src 'none'",
    `style-src 'nonce-${nonce}'`,
    "style-src-attr 'none'",
    "img-src 'none'",
    "font-src 'none'",
    "media-src 'none'",
    "connect-src 'none'",
    "form-action 'none'",
    "frame-src 'none'",
    "worker-src 'none'",
    "manifest-src 'none'",
    "frame-ancestors 'self'",
  ].join('; ');
}

export function legacySpecificationToHtmlArtifact(specification: {
  content: {
    eyebrow: string;
    title: string;
    dateLine: string;
    venueLine: string;
  };
  colors: {
    background: string;
    surface: string;
    text: string;
    accent: string;
  };
  typography: {
    headingFamily: string;
    bodyFamily: string;
  };
  layout: {
    alignment: string;
    density: string;
  };
}): HtmlArtifactEnvelope {
  const body = [
    '<main class="invitation">',
    '<header class="hero">',
    '<p class="eyebrow">' + escapeHtml(specification.content.eyebrow) + '</p>',
    '<h1>' + escapeHtml(specification.content.title) + '</h1>',
    '<p class="details">' + escapeHtml(specification.content.dateLine) + '</p>',
    '<p class="details">' + escapeHtml(specification.content.venueLine) + '</p>',
    '</header>',
    '</main>',
  ].join('');
  const css = [
    ':root{color-scheme:light}',
    '*{box-sizing:border-box}',
    'html,body{min-height:100%;margin:0}',
    'body{display:grid;place-items:center;padding:clamp(1.5rem,5vw,5rem);font-family:' +
      cssFont(specification.typography.bodyFamily) +
      ';background:' +
      specification.colors.background +
      ';color:' +
      specification.colors.text +
      '}',
    '.invitation{width:min(100%,72rem);overflow:hidden;border-radius:2rem;background:' +
      specification.colors.surface +
      ';box-shadow:0 1.5rem 4rem rgba(0,0,0,.12);text-align:' +
      (specification.layout.alignment === 'left' ? 'left' : 'center') +
      '}',
    '.hero{display:grid;gap:1rem;padding:clamp(3rem,9vw,8rem) clamp(1.5rem,7vw,6rem)}',
    '.eyebrow{margin:0;color:' +
      specification.colors.accent +
      ';font-size:.8rem;font-weight:700;letter-spacing:.18em;text-transform:uppercase}',
    'h1{margin:0;max-width:18ch;font-family:' +
      cssFont(specification.typography.headingFamily) +
      ';font-size:clamp(2.75rem,9vw,7rem);font-weight:500;line-height:.98}',
    '.details{margin:0;font-size:clamp(1rem,2.5vw,1.35rem);line-height:1.6}',
    '@media (max-width:40rem){.invitation{border-radius:1.25rem}.hero{padding-block:3.5rem}}',
  ].join('');
  return sanitizeHtmlArtifact({
    format: HTML_ARTIFACT_FORMAT,
    version: HTML_ARTIFACT_VERSION,
    title: specification.content.title,
    description: `${specification.content.dateLine} at ${specification.content.venueLine}`,
    body,
    css,
  });
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function plainText(value: unknown, max: number, field: string): string {
  if (typeof value !== 'string') throw new HtmlArtifactValidationError(field);
  if (value.length > max * 8) throw new HtmlArtifactValidationError(field);
  const cleaned = stripControlCharacters(
    decodeEntities(
      sanitizeHtml(value, {
        allowedTags: [],
        allowedAttributes: {},
        nonTextTags: ['script', 'style', 'textarea', 'option', 'noscript'],
      })
    )
  )
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned || cleaned.length > max) throw new HtmlArtifactValidationError(field);
  return cleaned;
}

function sanitizeBody(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new HtmlArtifactValidationError('body');
  }
  if (value.length > MAX_BODY_INPUT) throw new HtmlArtifactValidationError('body');
  const body = sanitizeHtml(value, {
    allowedTags: HTML_TAGS,
    allowedAttributes: {
      '*': ['class', 'id', 'aria-*', 'role', 'lang', 'dir', 'title'],
      time: ['datetime'],
    },
    allowedClasses: { '*': [SAFE_CLASS] },
    allowedSchemes: [],
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    nonTextTags: [
      'script',
      'style',
      'textarea',
      'option',
      'noscript',
      'iframe',
      'object',
      'embed',
      'template',
      'svg',
      'math',
      'form',
      'button',
      'input',
      'select',
      'video',
      'audio',
      'canvas',
    ],
    nestingLimit: 20,
    transformTags: {
      '*': (tagName, attributes) => {
        const next = { ...attributes };
        if (!SAFE_IDENTIFIER.test(next.id ?? '')) delete next.id;
        if (
          !/^(?:article|banner|button|heading|img|list|listitem|main|none|presentation|row|rowgroup|table|tablecell)$/i.test(
            next.role ?? ''
          )
        ) {
          delete next.role;
        }
        if (!/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/.test(next.lang ?? '')) delete next.lang;
        if (!/^(?:auto|ltr|rtl)$/.test(next.dir ?? '')) delete next.dir;
        for (const name of Object.keys(next)) {
          if (name.startsWith('aria-') && next[name]!.length > 200) delete next[name];
        }
        return { tagName, attribs: next };
      },
    },
  }).trim();
  if (!body || body.length > HTML_ARTIFACT_LIMITS.body) {
    throw new HtmlArtifactValidationError('body');
  }
  return body;
}

function sanitizeCss(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new HtmlArtifactValidationError('css');
  if (value.length > MAX_CSS_INPUT) throw new HtmlArtifactValidationError('css');
  if (/[<>\\]/.test(value) || hasControlCharacters(value)) {
    throw new HtmlArtifactValidationError('css');
  }
  let root;
  try {
    root = postcss.parse(value);
  } catch {
    throw new HtmlArtifactValidationError('css');
  }
  let rules = 0;
  let declarations = 0;
  root.walkComments((comment) => {
    comment.remove();
  });
  root.walkAtRules((atRule) => {
    const name = atRule.name.toLowerCase();
    if (!['media', 'supports', 'keyframes', '-webkit-keyframes'].includes(name)) {
      atRule.remove();
      return;
    }
    if (name === 'media' || name === 'supports') {
      if (!SAFE_AT_RULE_PARAMS.test(atRule.params) || FORBIDDEN_CSS_VALUE.test(atRule.params)) {
        atRule.remove();
      }
      return;
    }
    if (!SAFE_IDENTIFIER.test(atRule.params)) atRule.remove();
  });
  root.walkRules((rule) => {
    rules += 1;
    const keyframe = parentAtRule(rule, ['keyframes', '-webkit-keyframes']);
    if (keyframe) {
      if (!/^(?:from|to|(?:0|[1-9]?\d|100)%)$/.test(rule.selector)) rule.remove();
    } else if (!SAFE_SELECTOR.test(rule.selector)) {
      rule.remove();
    }
  });
  root.walkDecls((declaration) => {
    declarations += 1;
    const property = declaration.prop.trim().toLowerCase();
    const propertyAllowed = property.startsWith('--')
      ? SAFE_IDENTIFIER.test(property.slice(2))
      : SAFE_CSS_PROPERTIES.has(property);
    if (!propertyAllowed || !isSafeCssValue(declaration.value)) declaration.remove();
  });
  if (rules > MAX_CSS_RULES || declarations > MAX_CSS_DECLARATIONS) {
    throw new HtmlArtifactValidationError('css');
  }
  const css = root.toString().trim();
  if (
    !css ||
    css.length > HTML_ARTIFACT_LIMITS.css ||
    /[<>\\]/.test(css) ||
    FORBIDDEN_CSS_VALUE.test(css)
  ) {
    throw new HtmlArtifactValidationError('css');
  }
  return css;
}

function stripControlCharacters(value: string): string {
  return Array.from(value)
    .filter((character) => {
      const code = character.codePointAt(0) ?? 0;
      return !(
        code <= 8 ||
        code === 11 ||
        code === 12 ||
        (code >= 14 && code <= 31) ||
        code === 127
      );
    })
    .join('');
}

function hasControlCharacters(value: string): boolean {
  return Array.from(value).some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code <= 8 || code === 11 || code === 12 || (code >= 14 && code <= 31) || code === 127;
  });
}

function isSafeCssValue(value: string): boolean {
  const normalized = value.trim();
  if (!normalized || normalized.length > 1_000) return false;
  if (FORBIDDEN_CSS_VALUE.test(normalized)) return false;
  if (/[<>\\{};@]/.test(normalized) || hasControlCharacters(normalized)) return false;
  return true;
}

function parentAtRule(rule: Rule, names: string[]): AtRule | null {
  let parent: Container | Document | undefined = rule.parent;
  while (parent) {
    if (parent.type === 'atrule' && names.includes((parent as AtRule).name.toLowerCase())) {
      return parent as AtRule;
    }
    parent = parent.parent;
  }
  return null;
}

function decodeEntities(value: string): string {
  const named: Record<string, string> = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: '\u00a0',
    quot: '"',
  };
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|apos|gt|lt|nbsp|quot);/gi, (entity, key: string) => {
    const normalized = key.toLowerCase();
    if (normalized.startsWith('#x')) {
      const code = Number.parseInt(normalized.slice(2), 16);
      return isValidCodePoint(code) ? String.fromCodePoint(code) : entity;
    }
    if (normalized.startsWith('#')) {
      const code = Number.parseInt(normalized.slice(1), 10);
      return isValidCodePoint(code) ? String.fromCodePoint(code) : entity;
    }
    return named[normalized] ?? entity;
  });
}

function isValidCodePoint(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 0x10ffff;
}

function cssFont(value: string): string {
  return value === 'Playfair Display'
    ? "'Playfair Display', Georgia, serif"
    : 'Inter, system-ui, sans-serif';
}
