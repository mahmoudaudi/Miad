'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiError } from '@/lib/api-client';
import { publishCommunityDesign } from '@/lib/community';

export function PublishCommunityForm({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const [values, setValues] = useState({ title: '', description: '', category: 'Wedding', slug: '' });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await publishCommunityDesign(invitationId, values);
      router.push('/dashboard/community');
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'We could not publish this design.');
      setSaving(false);
    }
  }
  return (
    <form onSubmit={submit} className="mt-8 space-y-5 rounded-2xl border border-line bg-surface p-6 shadow-subtle sm:p-8">
      {error && <p role="alert" className="rounded-xl border border-error/20 p-3 text-body-sm text-error">{error}</p>}
      <label className="block text-label-md text-ink">Community title<input required maxLength={120} className="miad-input mt-2" value={values.title} onChange={(event) => setValues({ ...values, title: event.target.value })} /></label>
      <label className="block text-label-md text-ink">Description<textarea required maxLength={500} rows={4} className="miad-input mt-2" value={values.description} onChange={(event) => setValues({ ...values, description: event.target.value })} /></label>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block text-label-md text-ink">Category<input required maxLength={50} className="miad-input mt-2" value={values.category} onChange={(event) => setValues({ ...values, category: event.target.value })} /></label>
        <label className="block text-label-md text-ink">Public slug<input maxLength={120} className="miad-input mt-2" placeholder="optional" value={values.slug} onChange={(event) => setValues({ ...values, slug: event.target.value })} /></label>
      </div>
      <button disabled={saving} className="rounded-xl bg-primary px-5 py-3 text-label-md text-white disabled:opacity-60">{saving ? 'Publishing…' : 'Publish to Community'}</button>
    </form>
  );
}
