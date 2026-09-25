'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/lib/api-client';
import {
  completeMediaUpload,
  deleteMediaAsset,
  isRetryableMediaError,
  listMedia,
  MediaRecord,
  requestMediaUpload,
  uploadToSignedTarget,
  validateMediaFile,
} from '@/lib/media';
import { DeleteConfirmationDialog } from '@/components/dashboard/DeleteConfirmationDialog';
import { MediaLibraryState, MediaLibraryView, MediaUploadState } from './MediaLibraryView';

type UploadAttempt = {
  file: File;
  fileName: string;
  fileType: string;
  fileSize: number;
  stage: 'request' | 'put' | 'complete';
  mediaId?: string;
  uploadUrl?: string;
  progress: number;
};

export function MediaLibraryClient({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const loaded = useRef(false);
  const attemptRef = useRef<UploadAttempt | null>(null);
  const runningRef = useRef(false);
  const [state, setState] = useState<MediaLibraryState>({ status: 'loading' });
  const [upload, setUpload] = useState<MediaUploadState>({ status: 'idle' });
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [selected, setSelected] = useState<MediaRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const path = `/dashboard/invitations/${invitationId}/media`;

  const redirectToLogin = useCallback(() => {
    router.replace(`/login?next=${encodeURIComponent(path)}`);
  }, [path, router]);

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    setLoadMoreError(null);
    try {
      const page = await listMedia(invitationId);
      setState({ status: 'ready', items: page.items, nextCursor: page.nextCursor });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) redirectToLogin();
      else if (error instanceof ApiError && error.status === 404) setState({ status: 'not-found' });
      else setState({ status: 'error', message: 'Check your connection and try again.' });
    }
  }, [invitationId, redirectToLogin]);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    void load();
  }, [load]);

  const runUpload = useCallback(
    async (attempt: UploadAttempt) => {
      if (runningRef.current) return;
      runningRef.current = true;
      attemptRef.current = attempt;
      try {
        if (attempt.stage === 'request') {
          setUpload({ status: 'uploading', fileName: attempt.fileName, progress: 0 });
          const target = await requestMediaUpload(invitationId, {
            fileName: attempt.fileName,
            fileType: attempt.fileType,
            fileSize: attempt.fileSize,
          });
          attempt.mediaId = target.mediaId;
          attempt.uploadUrl = target.uploadUrl;
          attempt.stage = 'put';
        }
        if (attempt.stage === 'put') {
          setUpload({
            status: 'uploading',
            fileName: attempt.fileName,
            progress: attempt.progress,
          });
          await uploadToSignedTarget(attempt.uploadUrl!, attempt.file, (progress) => {
            attempt.progress = progress;
            setUpload({ status: 'uploading', fileName: attempt.fileName, progress });
          });
          attempt.stage = 'complete';
        }
        if (attempt.stage === 'complete') {
          setUpload({ status: 'finalizing', fileName: attempt.fileName });
          const record = await completeMediaUpload(invitationId, attempt.mediaId!, {
            fileName: attempt.fileName,
            fileType: attempt.fileType,
            fileSize: attempt.fileSize,
          });
          setState((current) =>
            current.status === 'ready'
              ? {
                  status: 'ready',
                  items: [record, ...current.items.filter((item) => item.id !== record.id)],
                  nextCursor: current.nextCursor,
                }
              : current
          );
          setUpload({ status: 'success', message: `“${record.fileName}” was uploaded.` });
          attemptRef.current = null;
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          redirectToLogin();
          return;
        }
        if (error instanceof ApiError && error.status === 404) {
          setState({ status: 'not-found' });
          attemptRef.current = null;
          return;
        }
        const retryable = isRetryableMediaError(error);
        const message =
          error instanceof ApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : 'We could not upload this file. Please try again.';
        setUpload({ status: 'error', message, retryable });
        if (!retryable) attemptRef.current = null;
      } finally {
        runningRef.current = false;
      }
    },
    [invitationId, redirectToLogin]
  );

  const onFileSelected = useCallback(
    (file: File | null) => {
      if (!file) return;
      const validationError = validateMediaFile(file);
      if (validationError) {
        attemptRef.current = null;
        setUpload({ status: 'error', message: validationError, retryable: false });
        return;
      }
      void runUpload({
        file,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        stage: 'request',
        progress: 0,
      });
    },
    [runUpload]
  );

  const onRetryUpload = useCallback(() => {
    const attempt = attemptRef.current;
    if (!attempt) return;
    void runUpload(attempt);
  }, [runUpload]);

  const onLoadMore = useCallback(async () => {
    if (state.status !== 'ready' || !state.nextCursor || loadingMore) return;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const page = await listMedia(invitationId, state.nextCursor);
      setState((current) =>
        current.status === 'ready'
          ? {
              status: 'ready',
              items: [
                ...current.items,
                ...page.items.filter(
                  (item) => !current.items.some((existing) => existing.id === item.id)
                ),
              ],
              nextCursor: page.nextCursor,
            }
          : current
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) redirectToLogin();
      else if (error instanceof ApiError && error.status === 404) setState({ status: 'not-found' });
      else setLoadMoreError('We could not load more media. Please try again.');
    } finally {
      setLoadingMore(false);
    }
  }, [invitationId, loadingMore, redirectToLogin, state]);

  const remove = useCallback(async () => {
    if (!selected || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteMediaAsset(invitationId, selected.id);
      setState((current) =>
        current.status === 'ready'
          ? { ...current, items: current.items.filter((item) => item.id !== selected.id) }
          : current
      );
      setSelected(null);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) redirectToLogin();
      else if (error instanceof ApiError && error.status === 404) {
        // Already gone — reflect that locally and close the dialog.
        setState((current) =>
          current.status === 'ready'
            ? { ...current, items: current.items.filter((item) => item.id !== selected.id) }
            : current
        );
        setSelected(null);
      } else {
        setDeleteError(
          error instanceof ApiError ? error.message : 'We could not delete this media file.'
        );
      }
    } finally {
      setDeleting(false);
    }
  }, [deleting, invitationId, redirectToLogin, selected]);

  return (
    <>
      <MediaLibraryView
        invitationId={invitationId}
        state={state}
        upload={upload}
        loadingMore={loadingMore}
        loadMoreError={loadMoreError}
        onRetryLoad={() => void load()}
        onFileSelected={onFileSelected}
        onRetryUpload={() => onRetryUpload()}
        onLoadMore={() => void onLoadMore()}
        onDelete={(item) => {
          setDeleteError(null);
          setSelected(item);
        }}
      />
      {selected && (
        <DeleteConfirmationDialog
          title="Delete this media file?"
          description={`“${selected.fileName}” will be permanently removed from this invitation.`}
          confirmLabel="Delete file"
          busyLabel="Deleting…"
          busy={deleting}
          error={deleteError}
          onCancel={() => {
            if (!deleting) {
              setSelected(null);
              setDeleteError(null);
            }
          }}
          onConfirm={() => void remove()}
        />
      )}
    </>
  );
}
