'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useMemo, useState } from 'react';
import { ApiError } from '@/lib/api-client';
import { cloneCommunityDesign, type CommunityDesignRecord } from '@/lib/community';

type CommunityPreview = {
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

function previewFor(value: unknown): CommunityPreview {
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

export function CommunityBrowser({ designs }: { designs: CommunityDesignRecord[] }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [cloningId, setCloningId] = useState<string | null>(null);
  const [cloneError, setCloneError] = useState<{ id: string; message: string } | null>(null);
  const categories = ['all', ...Array.from(new Set(designs.map((design) => design.category)))];
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return designs.filter((design) => {
      const matchesCategory = category === 'all' || design.category === category;
      const matchesSearch = !query || `${design.title} ${design.description} ${design.creator.name}`.toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [category, designs, search]);

  async function cloneDesign(design: CommunityDesignRecord) {
    if (cloningId) return;
    setCloningId(design.id);
    setCloneError(null);
    try {
      const clone = await cloneCommunityDesign(design.slug);
      router.push(`/dashboard/invitations/new?invitationId=${encodeURIComponent(clone.invitationId)}&cloned=1`);
    } catch (error) {
      setCloneError({
        id: design.id,
        message:
          error instanceof ApiError
            ? error.status === 401
              ? 'Sign in to make your own copy of this design.'
              : error.message
            : 'We could not clone this design. Please try again.',
      });
    } finally {
      setCloningId(null);
    }
  }

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <label className="sr-only" htmlFor="community-search">Search community designs</label>
        <input id="community-search" className="miad-input" placeholder="Search designs" value={search} onChange={(event) => setSearch(event.target.value)} />
        <select aria-label="Filter community designs by category" className="miad-input sm:max-w-52" value={category} onChange={(event) => setCategory(event.target.value)}>
          {categories.map((item) => <option key={item} value={item}>{item === 'all' ? 'All categories' : item}</option>)}
        </select>
      </div>
      {visible.length === 0 ? (
        <p role="status" className="mt-8 rounded-2xl border border-line bg-surface p-10 text-center text-body-md text-muted">No community designs match this search.</p>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((design) => (
            <article key={design.id} className="overflow-hidden rounded-2xl border border-line bg-surface shadow-subtle">
              {(() => {
                const preview = previewFor(design.specification);
                return (
                  <div className="min-h-52 p-5" style={{ backgroundColor: preview.background, color: preview.text }}>
                    <p className="text-label-sm uppercase tracking-[0.16em]" style={{ color: preview.accent }}>{design.category}</p>
                    <h2 className="mt-12 break-words font-display text-3xl" style={{ fontFamily: preview.headingFamily }}>{design.title}</h2>
                    <p className="mt-3 text-body-sm opacity-75">{preview.dateLine}</p>
                    {!preview.available && <p className="mt-3 text-label-sm">Preview unavailable</p>}
                  </div>
                );
              })()}
              <div className="p-5">
                <p className="line-clamp-2 text-body-sm text-muted">{design.description}</p>
                <p className="mt-3 text-label-sm text-muted">By {design.creator.name} · {design.engagement.views} views</p>
                {isRecord(design.specification) ? (
                  <button
                    type="button"
                    onClick={() => void cloneDesign(design)}
                    disabled={cloningId !== null}
                    aria-busy={cloningId === design.id}
                    className="mt-5 block w-full rounded-xl bg-primary px-4 py-3 text-center text-label-md text-white disabled:cursor-wait disabled:opacity-70"
                  >
                    {cloningId === design.id ? 'Creating your copy…' : 'Use this design'}
                  </button>
                ) : (
                  <p role="status" className="mt-5 rounded-xl bg-secondary px-4 py-3 text-center text-label-sm text-muted">This design is unavailable.</p>
                )}
                {cloneError?.id === design.id && (
                  <div className="mt-3 text-body-sm text-danger" role="alert">
                    {cloneError.message}{' '}
                    {cloneError.message.startsWith('Sign in') && (
                      <Link href={`/login?next=${encodeURIComponent('/community')}`} className="underline">Sign in</Link>
                    )}
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
