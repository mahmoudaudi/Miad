'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { CommunityDesignRecord } from '@/lib/community';

export function CommunityBrowser({ designs }: { designs: CommunityDesignRecord[] }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const categories = ['all', ...Array.from(new Set(designs.map((design) => design.category)))];
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return designs.filter((design) => {
      const matchesCategory = category === 'all' || design.category === category;
      const matchesSearch = !query || `${design.title} ${design.description} ${design.creator.name}`.toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [category, designs, search]);

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
              <div className="min-h-52 p-5" style={{ backgroundColor: design.specification.colors.background, color: design.specification.colors.text }}>
                <p className="text-label-sm uppercase tracking-[0.16em]" style={{ color: design.specification.colors.accent }}>{design.category}</p>
                <h2 className="mt-12 break-words font-display text-3xl" style={{ fontFamily: design.specification.typography.headingFamily }}>{design.title}</h2>
                <p className="mt-3 text-body-sm opacity-75">{design.specification.content.dateLine}</p>
              </div>
              <div className="p-5">
                <p className="line-clamp-2 text-body-sm text-muted">{design.description}</p>
                <p className="mt-3 text-label-sm text-muted">By {design.creator.name} · {design.engagement.views} views</p>
                <Link href={`/dashboard/invitations/new?community=${encodeURIComponent(design.slug)}`} className="mt-5 block rounded-xl bg-primary px-4 py-3 text-center text-label-md text-white">Use this design</Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
