'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiError } from '@/lib/api-client';
import { createGuest, GuestInput } from '@/lib/guests';
import { GuestForm } from './GuestForm';

export function CreateGuestClient({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const base = `/dashboard/events/${eventId}/guests`;
  const submit = async (input: GuestInput) => {
    setSubmitting(true);
    setError(null);
    try {
      const guest = await createGuest(eventId, input);
      router.push(`${base}/${guest.id}`);
      router.refresh();
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        router.replace(`/login?next=${encodeURIComponent(`${base}/new`)}`);
        return;
      }
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'We could not add this guest. Please try again.'
      );
      setSubmitting(false);
    }
  };
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14 lg:py-16">
      <Link href={base} className="text-label-md text-muted hover:text-ink">
        ← Back to Guests
      </Link>
      <p className="mt-8 text-label-sm uppercase tracking-[0.16em] text-accent">Guest list</p>
      <h1 className="mt-3 font-display text-headline-lg-mobile text-ink sm:text-headline-lg">
        Add a guest
      </h1>
      <p className="mt-3 text-body-lg text-muted">
        Add contact details now; their attendance confirmation will appear here when submitted.
      </p>
      <section className="mt-10 rounded-2xl border border-line bg-surface p-5 shadow-subtle sm:p-8">
        <GuestForm
          submitLabel="Add Guest"
          cancelHref={base}
          submitting={submitting}
          serverError={error}
          onSubmit={(input) => void submit(input)}
        />
      </section>
    </main>
  );
}
