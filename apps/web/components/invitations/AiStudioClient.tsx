'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useDashboardSession, useWorkspaceActions } from '@/components/dashboard/DashboardShell';
import { ApiError } from '@/lib/api-client';
import {
  generateAiStudio,
  resolveMediaElements,
  withHeroImage,
  type AiStudioResult,
} from '@/lib/ai-studio';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import {
  completeMediaUpload,
  listMedia,
  requestMediaUpload,
  uploadToSignedTarget,
  validateMediaFile,
} from '@/lib/media';
import {
  generateHtmlInvitationDesign,
  saveInvitationEditor,
  type InvitationDesignSpecification,
} from '@/lib/invitation-designs';
import { applyCommunityDesign } from '@/lib/community';
import {
  clearPendingInvitationPrompt,
  readPendingInvitationPrompt,
} from '@/lib/pending-invitation-prompt';
import { listInvitations } from '@/lib/invitations';
import {
  AiStudioView,
  type StudioMessage,
  type StudioPreview,
  type StudioRecentInvitation,
} from './AiStudioView';
import { StudioImageBar } from './StudioImageBar';

type SpeechRecognitionInstance = {
  lang: string;
  interimResults: boolean;
  onresult: ((event: {
    resultIndex: number;
    results: ArrayLike<
      ({ isFinal: boolean } & ArrayLike<{ transcript: string } | undefined>) | undefined
    >;
  }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

function speechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const scoped = window as unknown as Record<string, unknown>;
  const ctor = scoped.SpeechRecognition ?? scoped.webkitSpeechRecognition ?? null;
  return typeof ctor === 'function' ? (ctor as unknown as SpeechRecognitionConstructor) : null;
}

export function AiStudioClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useDashboardSession();
  const { loggingOut, onLogout } = useWorkspaceActions();
  const { locale } = useLocale();
  const suggestions = getDictionary(locale).hero.promptPool.slice(0, 3);
  const profile = {
    name: `${user.firstName} ${user.lastName}`.trim() || 'Your account',
    email: user.email,
    initials:
      `${user.firstName.trim().charAt(0)}${user.lastName.trim().charAt(0)}`.toUpperCase() || 'M',
  };
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<StudioMessage[]>([]);
  const [preview, setPreview] = useState<StudioPreview>({ status: 'empty' });
  const [working, setWorking] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [failed, setFailed] = useState<{ invitationId: string; message: string } | null>(null);
  const [invitationId, setInvitationId] = useState<string | null>(null);
  const [spec, setSpec] = useState<InvitationDesignSpecification | null>(null);
  const [eventType, setEventType] = useState<string | null>(null);
  const [mediaPreviews, setMediaPreviews] = useState<Record<string, string>>({});
  const [imageUrl, setImageUrl] = useState('');
  const [imageNotice, setImageNotice] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [recentInvitations, setRecentInvitations] = useState<StudioRecentInvitation[]>([]);
  const communitySlug = searchParams.get('community');
  const [micSupported, setMicSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const lastPrompt = useRef<string | null>(null);
  const autoSent = useRef(false);
  const sendInFlight = useRef(false);
  const retryInFlight = useRef(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const dictationBaseRef = useRef('');
  const dictationFinalRef = useRef('');

  useEffect(() => {
    setMicSupported(speechRecognitionConstructor() !== null);
    return () => {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    };
  }, []);

  const toggleVoiceInput = useCallback(() => {
    const Constructor = speechRecognitionConstructor();
    if (!Constructor) return;
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const recognition = new Constructor();
    recognitionRef.current = recognition;
    recognition.lang = navigator.language || 'en-US';
    recognition.interimResults = true;
    dictationBaseRef.current = prompt;
    dictationFinalRef.current = '';
    recognition.onresult = (event) => {
      let interim = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result?.[0]?.transcript ?? '';
        if (!transcript) continue;
        if (result?.isFinal) {
          dictationFinalRef.current = `${dictationFinalRef.current} ${transcript}`.trim();
        } else {
          interim = `${interim} ${transcript}`.trim();
        }
      }
      setPrompt(
        [dictationBaseRef.current.trim(), dictationFinalRef.current.trim(), interim]
          .filter(Boolean)
          .join(' ')
      );
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    try {
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, [listening, prompt]);

  useEffect(() => {
    let active = true;
    void listInvitations()
      .then((invitations) => {
        if (!active) return;
        setRecentInvitations(
          invitations.slice(0, 5).map((invitation) => ({
            id: invitation.id,
            title: invitation.event.title,
            eventDate: invitation.event.eventDate,
          }))
        );
      })
      .catch((caught) => {
        if (caught instanceof ApiError && caught.status === 401) {
          router.replace('/login?next=%2Fdashboard%2Finvitations%2Fnew');
        }
      });
    return () => {
      active = false;
    };
  }, [router]);

  const applyResult = useCallback((result: AiStudioResult, communitySpecification?: InvitationDesignSpecification) => {
    setInvitationId(result.invitation.id);
    setEventType(result.event.eventType);
    if (communitySpecification) {
      setSpec(communitySpecification);
      setPreview({ status: 'ready', title: communitySpecification.content.title, specification: communitySpecification });
      setMessages((current) => [...current, { role: 'ai', text: `Done — the community design is ready for your event.` }]);
      setFailed(null);
      clearPendingInvitationPrompt();
    } else if (result.design) {
      const artifact = result.design.artifact;
      setSpec(null);
      setPreview({
        status: 'ready',
        title: artifact.title,
        artifact,
        renderUrl: `/api/designs/${result.invitation.id}/render`,
      });
      setMessages((current) => [
        ...current,
        {
          role: 'ai',
          text: `Done — “${artifact.title}” is ready.`,
        },
      ]);
      setFailed(null);
      clearPendingInvitationPrompt();
    } else {
      setPreview({ status: 'failed' });
      setFailed({
        invitationId: result.invitation.id,
        message: result.aiError ?? 'AI generation is unavailable right now.',
      });
    }
  }, []);

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (text.length < 10 || working || sendInFlight.current) {
        if (text.length > 0 && text.length < 10) {
          setHint('Describe a little more — at least 10 characters.');
        }
        return;
      }
      setHint(null);
      setFailed(null);
      sendInFlight.current = true;
      setWorking(true);
      setPreview({ status: 'working' });
      setMessages((current) => [...current, { role: 'user', text }]);
      lastPrompt.current = text;
      try {
        const result = await generateAiStudio(text);
        const communitySpecification = communitySlug
          ? (await applyCommunityDesign(communitySlug, result.invitation.id)).designSpecification
          : undefined;
        applyResult(result, communitySpecification);
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 401) {
          router.replace('/login?next=%2Fdashboard%2Finvitations%2Fnew');
          return;
        }
        setPreview({ status: 'empty' });
        setMessages((current) => [
          ...current,
          {
            role: 'ai',
            text:
              caught instanceof ApiError
                ? caught.message
                : 'Something went wrong. Check your connection and try again.',
          },
        ]);
      } finally {
        sendInFlight.current = false;
        setWorking(false);
      }
    },
    [applyResult, communitySlug, router, working]
  );

  const retry = useCallback(async () => {
    if (!failed || !lastPrompt.current || retrying || retryInFlight.current) return;
    retryInFlight.current = true;
    setRetrying(true);
    try {
      const design = await generateHtmlInvitationDesign(failed.invitationId, {
        prompt: lastPrompt.current,
        mode: 'generate',
      });
      setSpec(null);
      setPreview({
        status: 'ready',
        title: design.artifact.title,
        artifact: design.artifact,
        renderUrl: `/api/designs/${failed.invitationId}/render`,
      });
      setFailed(null);
      clearPendingInvitationPrompt();
      setMessages((current) => [...current, { role: 'ai', text: 'Done — the design is ready.' }]);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        router.replace('/login?next=%2Fdashboard%2Finvitations%2Fnew');
        return;
      }
      setFailed({
        invitationId: failed.invitationId,
        message:
          caught instanceof ApiError ? caught.message : 'AI generation is unavailable right now.',
      });
    } finally {
      retryInFlight.current = false;
      setRetrying(false);
    }
  }, [failed, retrying, router]);

  const persistHeroImage = useCallback(
    async (imageRef: string, freshPreviews: Record<string, string> = {}) => {
      if (!spec || !invitationId) return;
      const previews = { ...mediaPreviews, ...freshPreviews };
      const next = withHeroImage(spec, imageRef);
      try {
        const saved = await saveInvitationEditor(invitationId, next);
        setSpec(saved.designSpecification);
        setPreview({
          status: 'ready',
          title: saved.designSpecification.content.title,
          specification: resolveMediaElements(saved.designSpecification, previews),
        });
        setMessages((current) => [...current, { role: 'ai', text: 'Photo added to your design.' }]);
        setImageNotice('Photo added to your design.');
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 401) {
          router.replace('/login?next=%2Fdashboard%2Finvitations%2Fnew');
          return;
        }
        setImageNotice(
          caught instanceof ApiError ? caught.message : 'We could not add this photo. Try again.'
        );
      }
    },
    [spec, invitationId, mediaPreviews, router]
  );

  const handleFile = useCallback(
    async (file: File) => {
      if (!invitationId || uploading) return;
      const invalid = validateMediaFile(file);
      if (invalid) {
        setImageNotice(invalid);
        return;
      }
      setUploading(true);
      setUploadProgress(0);
      setImageNotice(null);
      try {
        const target = await requestMediaUpload(invitationId, {
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
        });
        await uploadToSignedTarget(target.uploadUrl, file, setUploadProgress);
        await completeMediaUpload(invitationId, target.mediaId, {
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
        });
        const library = await listMedia(invitationId);
        const previews: Record<string, string> = {};
        for (const item of library.items) {
          if (item.previewUrl) previews[item.id] = item.previewUrl;
        }
        setMediaPreviews((current) => ({ ...current, ...previews }));
        await persistHeroImage(`media://${target.mediaId}`, previews);
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 401) {
          router.replace('/login?next=%2Fdashboard%2Finvitations%2Fnew');
          return;
        }
        setImageNotice(caught instanceof ApiError ? caught.message : 'Upload failed. Try again.');
      } finally {
        setUploading(false);
        setUploadProgress(null);
      }
    },
    [invitationId, uploading, persistHeroImage, router]
  );

  const handleUrlAdd = useCallback(() => {
    const url = imageUrl.trim();
    if (!/^https?:\/\//.test(url) || url.length > 1000) {
      setImageNotice('Paste a valid https image link (up to 1000 characters).');
      return;
    }
    setImageUrl('');
    void persistHeroImage(url);
  }, [imageUrl, persistHeroImage]);

  const imageHint = (() => {
    const kind = (eventType ?? '').toLowerCase();
    if (/wedding|birthday|baby|graduation|shower/.test(kind)) {
      return 'Personal moments shine with your own photos — upload one, or paste an internet link.';
    }
    if (/corporate|conference|meeting|launch|networking/.test(kind)) {
      return 'A venue or brand image works well here — paste a link, or upload your own.';
    }
    return 'Upload your own photo, or paste an internet image link.';
  })();

  useEffect(() => {
    if (autoSent.current) return;
    autoSent.current = true;
    const saved = readPendingInvitationPrompt();
    if (saved?.trim()) {
      setPrompt(saved.trim());
      void send(saved.trim());
    }
  }, [send]);

  const editorHref = invitationId ? `/dashboard/invitations/${invitationId}/editor` : null;
  const detailsHref = invitationId ? `/dashboard/invitations/${invitationId}` : null;

  return (
    <AiStudioView
      messages={messages}
      preview={preview}
      prompt={prompt}
      hint={hint}
      sendDisabled={working || prompt.trim().length === 0}
      sendLabel={working ? 'Creating…' : 'Generate'}
      suggestions={messages.length === 0 ? suggestions : []}
      editorHref={editorHref}
      detailsHref={preview.status === 'ready' ? detailsHref : null}
      failedMessage={failed?.message ?? null}
      retrying={retrying}
      manualHref="/dashboard/events/new"
      profile={profile}
      imageBar={
        spec && invitationId ? (
          <StudioImageBar
            disabled={working}
            uploading={uploading}
            progress={uploadProgress}
            imageUrl={imageUrl}
            notice={imageNotice}
            hint={imageHint}
            onFile={(file) => void handleFile(file)}
            onUrlChange={setImageUrl}
            onUrlAdd={handleUrlAdd}
          />
        ) : null
      }
      recentInvitations={recentInvitations}
      micSupported={micSupported}
      listening={listening}
      onToggleVoice={toggleVoiceInput}
      loggingOut={loggingOut}
      onLogout={onLogout}
      onPromptChange={setPrompt}
      onSend={() => void send(prompt)}
      onSuggestion={(value) => {
        setPrompt(value);
        void send(value);
      }}
      onRetry={() => void retry()}
    />
  );
}
