import type { Metadata } from 'next';
import { CommunityBrowser } from '@/components/community/CommunityBrowser';
import { getCommunityDesigns } from '@/lib/community';

export const metadata: Metadata = { title: 'Community — Miad' };

export default async function DashboardCommunityBrowsePage() {
  try {
    const designs = await getCommunityDesigns();
    return (
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
        <header className="max-w-2xl">
          <p className="text-label-sm uppercase tracking-[0.16em] text-accent">Community</p>
          <h1 className="mt-3 font-display text-headline-lg-mobile text-ink sm:text-headline-lg">
            Designs made in Miad
          </h1>
          <p className="mt-4 text-body-lg text-muted">
            Browse public inspiration from the Miad community and start your own invitation from a
            design you love.
          </p>
        </header>
        <section className="mt-8">
          <CommunityBrowser designs={designs} />
        </section>
      </main>
    );
  } catch {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="font-display text-headline-md text-ink">Community unavailable</h1>
        <p role="alert" className="mt-3 text-body-md text-muted">
          We could not load community designs. Please try again later.
        </p>
      </main>
    );
  }
}
