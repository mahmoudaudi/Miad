'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ApiError } from '@/lib/api-client';
import { listMyCommunityDesigns, updateCommunityPublication, type CommunityDesignRecord } from '@/lib/community';

export default function DashboardCommunityPage() {
  const [designs, setDesigns] = useState<CommunityDesignRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { void listMyCommunityDesigns().then(setDesigns).catch((caught) => setError(caught instanceof ApiError ? caught.message : 'We could not load your community designs.')); }, []);
  return <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12"><Link href="/dashboard/invitations/new" className="text-label-md text-muted hover:text-ink">← AI Studio</Link><header className="mt-8"><p className="text-label-sm uppercase tracking-[0.16em] text-accent">Your community designs</p><h1 className="mt-3 font-display text-headline-lg-mobile text-ink sm:text-headline-lg">Manage shared designs</h1></header>{error && <p role="alert" className="mt-6 text-body-sm text-error">{error}</p>}<div className="mt-8 grid gap-5 sm:grid-cols-2">{designs.map((design) => <article key={design.id} className="rounded-2xl border border-line bg-surface p-5 shadow-subtle"><div className="flex items-start justify-between gap-4"><div><h2 className="font-display text-headline-sm text-ink">{design.title}</h2><p className="mt-1 text-body-sm text-muted">{design.category} · {design.engagement.views} views</p></div><span className="text-label-sm text-muted">{design.isPublished ? 'Published' : 'Unpublished'}</span></div><p className="mt-4 text-body-sm text-muted">{design.description}</p><button type="button" className="mt-5 rounded-xl border border-line px-4 py-2.5 text-label-md text-ink" onClick={() => void updateCommunityPublication(design.id, !design.isPublished).then(() => setDesigns((current) => current.map((item) => item.id === design.id ? { ...item, isPublished: !item.isPublished } : item))).catch(() => setError('We could not update this design.'))}>{design.isPublished ? 'Unpublish' : 'Republish'}</button></article>)}</div>{designs.length === 0 && !error && <p className="mt-8 rounded-2xl border border-line bg-surface p-10 text-center text-body-md text-muted">You have not published a community design yet.</p>}</main>;
}
