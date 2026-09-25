'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError } from '@/lib/api-client';
import {
  completeInvitationSpecification,
  designSpecificationsMatch,
  generateInvitationDesign,
  getInvitationDesign,
  InvitationDesignSpecification,
  refineInvitationDesign,
  saveInvitationEditor,
} from '@/lib/invitation-designs';
import { InvitationEditorState, InvitationEditorView } from './InvitationEditorView';

export function InvitationEditorClient({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const loaded = useRef(false);
  const [state, setState] = useState<InvitationEditorState>({ status: 'loading' });
  const [draft, setDraft] = useState<InvitationDesignSpecification | null>(null);
  const [saved, setSaved] = useState<InvitationDesignSpecification | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [history, setHistory] = useState<InvitationDesignSpecification[]>([]);
  const [future, setFuture] = useState<InvitationDesignSpecification[]>([]);

  const dirty = useMemo(
    () => Boolean(draft && saved && !designSpecificationsMatch(draft, saved)),
    [draft, saved]
  );

  const redirectToLogin = useCallback(() => {
    router.replace(
      `/login?next=${encodeURIComponent(`/dashboard/invitations/${invitationId}/editor`)}`
    );
  }, [invitationId, router]);

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    setSaveError(null);
    setSuccessMessage(null);
    try {
      const result = await getInvitationDesign(invitationId);
      if (!result.design || 'artifact' in result.design) {
        setDraft(null);
        setSaved(null);
        setState({ status: 'missing-design' });
        return;
      }
      const specification = completeInvitationSpecification(result.design.designSpecification);
      setDraft(specification);
      setSaved(specification);
      setState({ status: 'ready', design: result.design });
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
    if (loaded.current) return;
    loaded.current = true;
    void load();
  }, [load]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const save = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (state.status !== 'ready' || !draft || !dirty || saving || aiBusy) return;
      setSaving(true);
      setSaveError(null);
      if (!silent) setSuccessMessage(null);
      try {
        const design = await saveInvitationEditor(invitationId, draft);
        const specification = completeInvitationSpecification(design.designSpecification);
        setState({ status: 'ready', design });
        // Keep edits made while the saved snapshot was in flight.
        setDraft((current) =>
          current && designSpecificationsMatch(current, draft) ? specification : current
        );
        setSaved(specification);
        setSuccessMessage(silent ? 'Autosaved.' : 'Changes saved.');
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
          error instanceof ApiError ? error.message : 'We could not save your changes. Try again.'
        );
      } finally {
        setSaving(false);
      }
    },
    [aiBusy, dirty, draft, invitationId, redirectToLogin, saving, state.status]
  );

  useEffect(() => {
    if (!dirty || saving || aiBusy || saveError || state.status !== 'ready') return;
    const id = window.setTimeout(() => {
      void save({ silent: true });
    }, 1800);
    return () => window.clearTimeout(id);
  }, [aiBusy, dirty, save, saveError, saving, state.status]);

  function changeDraft(next: InvitationDesignSpecification) {
    setDraft((current) => {
      if (current) setHistory((items) => [...items.slice(-19), current]);
      return completeInvitationSpecification(next);
    });
    setFuture([]);
    setSaveError(null);
    setSuccessMessage(null);
  }

  function undo() {
    if (!history.length || !draft) return;
    const previous = history[history.length - 1];
    if (!previous) return;
    setHistory((items) => items.slice(0, -1));
    setFuture((items) => [draft, ...items].slice(0, 20));
    setDraft(previous);
  }

  function redo() {
    if (!future.length || !draft) return;
    const next = future[0];
    if (!next) return;
    setFuture((items) => items.slice(1));
    setHistory((items) => [...items.slice(-19), draft]);
    setDraft(next);
  }

  async function runAi(mode: 'regenerate' | 'refine') {
    const instruction = aiPrompt.trim();
    if (!instruction || aiBusy || saving) return;
    setAiBusy(true);
    setSaveError(null);
    setSuccessMessage(null);
    try {
      const design =
        mode === 'regenerate'
          ? await generateInvitationDesign(invitationId, {
              prompt: instruction,
              mode: 'regenerate',
            })
          : await refineInvitationDesign(invitationId, instruction);
      const specification = completeInvitationSpecification(design.designSpecification);
      if (draft) setHistory((items) => [...items.slice(-19), draft]);
      setFuture([]);
      setState({ status: 'ready', design });
      setDraft(specification);
      setSaved(specification);
      setAiPrompt('');
      setSuccessMessage(mode === 'regenerate' ? 'Invitation regenerated.' : 'Invitation refined.');
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        redirectToLogin();
        return;
      }
      setSaveError(error instanceof ApiError ? error.message : 'The AI update failed. Try again.');
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <InvitationEditorView
      invitationId={invitationId}
      state={state}
      draft={draft}
      dirty={dirty}
      saving={saving}
      saveError={saveError}
      successMessage={successMessage}
      aiPrompt={aiPrompt}
      aiBusy={aiBusy}
      canUndo={history.length > 0}
      canRedo={future.length > 0}
      onAiPromptChange={setAiPrompt}
      onAiRegenerate={() => void runAi('regenerate')}
      onAiRefine={() => void runAi('refine')}
      onUndo={undo}
      onRedo={redo}
      onChange={changeDraft}
      onSave={() => void save()}
      onRetry={() => void load()}
    />
  );
}
