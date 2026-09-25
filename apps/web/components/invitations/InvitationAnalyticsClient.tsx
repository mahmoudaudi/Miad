'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ApiError } from '@/lib/api-client';
import { getInvitationAnalytics, type InvitationAnalytics } from '@/lib/analytics';
import { InvitationAnalyticsView } from './InvitationAnalyticsView';

export function InvitationAnalyticsClient({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const [analytics, setAnalytics] = useState<InvitationAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getInvitationAnalytics(invitationId)
      .then(setAnalytics)
      .catch((caught: unknown) => {
        if (caught instanceof ApiError && caught.status === 401) {
          router.replace(`/login?next=${encodeURIComponent(`/dashboard/invitations/${invitationId}/analytics`)}`);
          return;
        }
        setError(caught instanceof ApiError ? caught.message : 'We could not load analytics.');
      });
  }, [invitationId, router]);

  if (error) {
    return <main className="mx-auto max-w-2xl px-4 py-16 text-center"><p role="alert" className="text-body-md text-error">{error}</p></main>;
  }
  if (!analytics) {
    return <main aria-busy="true" className="mx-auto max-w-5xl px-4 py-12 sm:px-6"><div className="h-64 animate-pulse rounded-2xl border border-line bg-surface" /></main>;
  }
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
      <Link href={`/dashboard/invitations/${invitationId}`} className="text-label-md text-muted hover:text-ink">← Back to invitation</Link>
      <InvitationAnalyticsView analytics={analytics} />
    </main>
  );
}
