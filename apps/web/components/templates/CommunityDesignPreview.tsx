import React from 'react';

export type CommunityPreview = {
  background: string;
  text: string;
  accent: string;
  headingFamily: string;
  dateLine: string;
  available: boolean;
};

const fallbackPreview: CommunityPreview = {
  background: '#f4f0e8',
  text: '#272522',
  accent: '#8a6b46',
  headingFamily: 'Georgia, serif',
  dateLine: '',
  available: false,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Uses the existing Community snapshot fields only. Image URLs are deliberately
 * ignored so private or expired Storage URLs can never enter a public card.
 */
export function communityPreviewFor(value: unknown): CommunityPreview {
  if (!isRecord(value)) return fallbackPreview;
  const colors = isRecord(value.colors) ? value.colors : null;
  const content = isRecord(value.content) ? value.content : null;
  const typography = isRecord(value.typography) ? value.typography : null;
  const background = typeof colors?.background === 'string' ? colors.background : null;
  const text = typeof colors?.text === 'string' ? colors.text : null;
  const accent = typeof colors?.accent === 'string' ? colors.accent : null;
  return {
    background: background ?? fallbackPreview.background,
    text: text ?? fallbackPreview.text,
    accent: accent ?? fallbackPreview.accent,
    headingFamily:
      typeof typography?.headingFamily === 'string'
        ? typography.headingFamily
        : fallbackPreview.headingFamily,
    dateLine: typeof content?.dateLine === 'string' ? content.dateLine : '',
    available: Boolean(background && text && accent),
  };
}

export function CommunityDesignPreview({
  title,
  category,
  preview,
}: {
  title: string;
  category: string;
  preview: CommunityPreview;
}) {
  return (
    <div
      className="flex h-full flex-col p-5"
      style={{ backgroundColor: preview.background, color: preview.text }}
    >
      <p
        className="text-[10px] font-semibold uppercase tracking-[0.16em]"
        style={{ color: preview.accent }}
      >
        {category}
      </p>
      <div className="my-auto">
        <h3
          className="break-words text-3xl leading-tight"
          style={{ fontFamily: preview.headingFamily }}
        >
          {title}
        </h3>
        {preview.dateLine ? <p className="mt-3 text-sm opacity-75">{preview.dateLine}</p> : null}
        {!preview.available ? (
          <p className="mt-3 text-xs font-medium opacity-70">Preview unavailable</p>
        ) : null}
      </div>
      <span className="h-1 w-10 rounded-full" style={{ backgroundColor: preview.accent }} />
    </div>
  );
}
