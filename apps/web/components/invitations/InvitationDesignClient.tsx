'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/lib/api-client';
import {
  createInvitationDesign,
  getInvitationDesign,
  InvitationThemeId,
  updateInvitationDesign,
} from '@/lib/invitation-designs';
import { InvitationDesignState, InvitationDesignView } from './InvitationDesignView';

export function InvitationDesignClient({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const [state, setState] = useState<InvitationDesignState>({ status: 'loading' });
  const [selectedTheme, setSelectedTheme] = useState<InvitationThemeId>('classic-ivory');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const redirectToLogin = useCallback(() => {
    router.replace(
      `/login?next=${encodeURIComponent(`/dashboard/invitations/${invitationId}/design`)}`
    );
  }, [invitationId, router]);

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    setSaveError(null);
    setSuccessMessage(null);
    try {
      const result = await getInvitationDesign(invitationId);
      if (result.design && 'artifact' in result.design) {
        setState({ status: 'not-found' });
        return;
      }
      setState({ status: 'ready', design: result.design });
      if (result.design) setSelectedTheme(result.design.designSpecification.theme);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) redirectToLogin();
      else if (error instanceof ApiError && error.status === 404) {
        setState({ status: 'not-found' });
      } else {
        setState({ status: 'error', message: 'Check your connection and try again.' });
      }
    }
  }, [invitationId, redirectToLogin]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (state.status !== 'ready' || saving) return;
    setSaving(true);
    setSaveError(null);
    setSuccessMessage(null);
    try {
      const design = state.design
        ? await updateInvitationDesign(invitationId, selectedTheme)
        : await createInvitationDesign(invitationId, selectedTheme);
      setState({ status: 'ready', design });
      setSuccessMessage(state.design ? 'Design updated.' : 'Design saved.');
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        redirectToLogin();
        return;
      }
      if (error instanceof ApiError && error.status === 404) {
        setState({ status: 'not-found' });
        return;
      }
      setSaveError(
        error instanceof ApiError ? error.message : 'We could not save this design. Try again.'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <InvitationDesignView
      invitationId={invitationId}
      state={state}
      selectedTheme={selectedTheme}
      saving={saving}
      saveError={saveError}
      successMessage={successMessage}
      onSelect={(theme) => {
        setSelectedTheme(theme);
        setSaveError(null);
        setSuccessMessage(null);
      }}
      onSave={() => void save()}
      onRetry={() => void load()}
    />
  );
}
