'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDashboardSession, useWorkspaceActions } from '@/components/dashboard/DashboardShell';
import { ApiError } from '@/lib/api-client';
import {
  generateAiStudio,
  analyzeAiStudio,
  buildGenerationContext,
  createAiGenerationId,
  observeAiGeneration,
  refineAiStudio,
  resolveMediaElements,
  withHeroImage,
  type AiStudioResult,
  type AiGenerationProgress,
  type SmartAnswer,
  type SmartCollectedData,
  type SmartQuestion,
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
  saveInvitationEditor,
  type GeneratedWebsiteProject,
  type InvitationDesignSpecification,
} from '@/lib/invitation-designs';
import { applyCommunityDesign } from '@/lib/community';
import {
  clearPendingInvitationPrompt,
  readPendingInvitationPrompt,
} from '@/lib/pending-invitation-prompt';
import { listInvitations, updateInvitationPublication } from '@/lib/invitations';
import {
  AiStudioView,
  isValidEditInstruction,
  type StudioMessage,
  type StudioPreview,
  type StudioQuestionPhase,
  type StudioRecentInvitation,
} from './AiStudioView';
import { StudioImageBar } from './StudioImageBar';

type SpeechRecognitionInstance = {
  lang: string;
  interimResults: boolean;
  onresult:
    | ((event: {
        resultIndex: number;
        results: ArrayLike<
          ({ isFinal: boolean } & ArrayLike<{ transcript: string } | undefined>) | undefined
        >;
      }) => void)
    | null;
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
  const promptPool = getDictionary(locale).hero.promptPool;
  // Two chips at a time, paged through the real prompt pool so the reload button
  // always yields a different pair instead of a decorative no-op.
  const [promptOffset, setPromptOffset] = useState(0);
  const [publishUrl, setPublishUrl] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [invitationIsPublished, setInvitationIsPublished] = useState(false);
  const [activeDesignVersion, setActiveDesignVersion] = useState<number | null>(null);
  const [publishedDesignVersion, setPublishedDesignVersion] = useState<number | null>(null);
  const suggestions = useMemo(() => {
    const size = promptPool.length;
    if (!size) return [];
    const count = Math.min(2, size);
    return Array.from(
      { length: count },
      (_, index) => promptPool[(promptOffset + index) % size]
    ).filter((value): value is string => Boolean(value));
  }, [promptPool, promptOffset]);
  const reloadSuggestions = useCallback(() => {
    setPromptOffset((current) => (current + 2) % promptPool.length);
  }, [promptPool.length]);
  const canReloadSuggestions = promptPool.length > 2;
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
  const [hint, setHint] = useState<string | null>(null);
  const [failed, setFailed] = useState<{ invitationId: string; message: string } | null>(null);
  const [invitationId, setInvitationId] = useState<string | null>(null);
  const [spec, setSpec] = useState<InvitationDesignSpecification | null>(null);
  const [websiteProject, setWebsiteProject] = useState<GeneratedWebsiteProject | null>(null);
  const [generationProgress, setGenerationProgress] = useState<AiGenerationProgress | null>(null);
  const [eventType, setEventType] = useState<string | null>(null);
  const [mediaPreviews, setMediaPreviews] = useState<Record<string, string>>({});
  const [imageUrl, setImageUrl] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [imageNotice, setImageNotice] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [recentInvitations, setRecentInvitations] = useState<StudioRecentInvitation[]>([]);
  const [recentProjectsLoading, setRecentProjectsLoading] = useState(true);
  const communitySlug = searchParams.get('community');
  const [micSupported, setMicSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const autoSent = useRef(false);
  const sendInFlight = useRef(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const dictationBaseRef = useRef('');
  const dictationFinalRef = useRef('');
  const progressStopRef = useRef<(() => void) | null>(null);
  // Real cancellation, scoped to this studio instance's current request:
  // aborting this controller aborts the active generation HTTP request.
  const requestControllerRef = useRef<AbortController | null>(null);
  const previewBeforeSendRef = useRef<StudioPreview>({ status: 'empty' });
  // Smart Question Flow: the session lives in client state only, so nothing
  // is persisted and no invitation exists until generation actually starts.
  const [questionPhase, setQuestionPhase] = useState<StudioQuestionPhase>('IDLE');
  const [question, setQuestion] = useState<SmartQuestion | null>(null);
  const questionSessionRef = useRef<{
    originalPrompt: string;
    collectedData: SmartCollectedData;
    answers: SmartAnswer[];
  } | null>(null);
  const [questionDisabled, setQuestionDisabled] = useState(false);

  useEffect(() => {
    setMicSupported(speechRecognitionConstructor() !== null);
    return () => {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    };
  }, []);

  useEffect(
    () => () => {
      requestControllerRef.current?.abort();
      progressStopRef.current?.();
    },
    []
  );

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
          invitations.map((invitation) => ({
            id: invitation.id,
            title: invitation.event.title,
            eventDate: invitation.event.eventDate,
            status: invitation.status,
            updatedAt: invitation.updatedAt,
            hasDesign: invitation.hasDesign,
          }))
        );
      })
      .catch((caught) => {
        if (caught instanceof ApiError && caught.status === 401) {
          router.replace('/login?next=%2Fdashboard%2Finvitations%2Fnew');
        }
      })
      .finally(() => {
        if (active) setRecentProjectsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [router]);

  const applyResult = useCallback(
    (result: AiStudioResult, communitySpecification?: InvitationDesignSpecification) => {
      setInvitationId(result.invitation.id);
      setPublishUrl(null);
      setInvitationIsPublished(
        result.invitation.status === 'PUBLISHED' && Boolean(result.invitation.publishedAt)
      );
      setActiveDesignVersion(result.design?.version ?? null);
      setPublishedDesignVersion(
        result.invitation.status === 'PUBLISHED' && result.invitation.publishedAt
          ? (result.design?.version ?? null)
          : null
      );
      setEventType(result.event.eventType);
      if (communitySpecification) {
        setSpec(communitySpecification);
        setPreview({
          status: 'ready',
          title: communitySpecification.content.title,
          specification: communitySpecification,
        });
        setMessages((current) => [
          ...current,
          { role: 'ai', text: `Done — the community design is ready for your event.` },
        ]);
        setFailed(null);
        clearPendingInvitationPrompt();
      } else if (result.design) {
        const artifact = result.design.artifact;
        setSpec(null);
        setWebsiteProject(result.design.project);
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
    },
    []
  );

  /**
   * The existing website generation step, unchanged: same endpoint, same SSE
   * progress, same Stop behaviour, same persistence. The Smart Question Flow
   * only ever decides *which* context string reaches it.
   */
  const runGeneration = useCallback(
    async (text: string, controller: AbortController) => {
      previewBeforeSendRef.current = preview;
      sendInFlight.current = true;
      setWorking(true);
      setPreview({ status: 'working' });
      let stopProgress: (() => void) | null = null;
      try {
        if (invitationId && websiteProject) {
          const design = await refineAiStudio(
            { invitationId, website: websiteProject, prompt: text },
            controller.signal
          );
          if (controller.signal.aborted) return;
          setSpec(null);
          setWebsiteProject(design.project);
          setPreview({
            status: 'ready',
            title: design.artifact.title,
            artifact: design.artifact,
            renderUrl: `/api/designs/${invitationId}/render`,
          });
          setMessages((current) => [
            ...current,
            { role: 'ai', text: `Updated — “${design.artifact.title}” reflects your changes.` },
          ]);
        } else {
          const generationId = createAiGenerationId();
          setGenerationProgress(null);
          stopProgress = observeAiGeneration(generationId, setGenerationProgress);
          progressStopRef.current = stopProgress;
          const result = await generateAiStudio(text, generationId, controller.signal);
          if (controller.signal.aborted) return;
          const communitySpecification = communitySlug
            ? (await applyCommunityDesign(communitySlug, result.invitation.id)).designSpecification
            : undefined;
          if (controller.signal.aborted) return;
          applyResult(result, communitySpecification);
        }
      } catch (caught) {
        if (controller.signal.aborted) {
          // User cancellation: close this request's SSE listener, return to
          // idle, and stay neutral — never a provider-failure message, and a
          // late result is ignored so no design is applied after cancelling.
          if (stopProgress) {
            stopProgress();
            if (progressStopRef.current === stopProgress) progressStopRef.current = null;
          }
          setGenerationProgress(null);
          setPreview(previewBeforeSendRef.current);
          setMessages((current) => [...current, { role: 'ai', text: 'Generation cancelled.' }]);
          return;
        }
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
        if (requestControllerRef.current === controller) requestControllerRef.current = null;
        sendInFlight.current = false;
        setWorking(false);
      }
    },
    [applyResult, communitySlug, invitationId, preview, router, websiteProject]
  );

  const regenerateDesign = useCallback(
    async (instruction: string) => {
      const cleanInstruction = instruction.trim();
      if (!isValidEditInstruction(cleanInstruction)) {
        setHint('Describe a design change using 3 to 1000 characters.');
        return;
      }
      if (
        !invitationId ||
        !websiteProject ||
        preview.status !== 'ready' ||
        working ||
        sendInFlight.current
      )
        return;
      const previousPreview = preview;
      const controller = new AbortController();
      requestControllerRef.current?.abort();
      requestControllerRef.current = controller;
      sendInFlight.current = true;
      setHint(null);
      setWorking(true);
      setGenerationProgress(null);
      setPreview({ status: 'working', operation: 'refine' });
      setMessages((current) => [...current, { role: 'user', text: cleanInstruction }]);
      try {
        const design = await refineAiStudio(
          { invitationId, website: websiteProject, prompt: cleanInstruction },
          controller.signal
        );
        if (controller.signal.aborted) return;
        setWebsiteProject(design.project);
        setActiveDesignVersion(design.version);
        setPreview({
          status: 'ready',
          title: design.artifact.title,
          artifact: design.artifact,
          renderUrl: `/api/designs/${invitationId}/render`,
        });
        setMessages((current) => [
          ...current,
          {
            role: 'ai',
            text: invitationIsPublished
              ? `Updated — “${design.artifact.title}” is ready. Publish the update when you want it to replace the public design.`
              : `Updated — “${design.artifact.title}” reflects your changes.`,
          },
        ]);
      } catch (caught) {
        setPreview(previousPreview);
        if (controller.signal.aborted) {
          setMessages((current) => [
            ...current,
            {
              role: 'ai',
              text: 'Design update cancelled. Your previous preview is still available.',
            },
          ]);
        } else if (caught instanceof ApiError && caught.status === 401) {
          router.replace('/login?next=%2Fdashboard%2Finvitations%2Fnew');
        } else {
          setMessages((current) => [
            ...current,
            {
              role: 'ai',
              text:
                caught instanceof ApiError
                  ? caught.message
                  : 'I could not update the design. Your previous version is still available.',
            },
          ]);
        }
      } finally {
        if (requestControllerRef.current === controller) requestControllerRef.current = null;
        sendInFlight.current = false;
        setWorking(false);
      }
    },
    [invitationId, invitationIsPublished, preview, router, websiteProject, working]
  );

  /**
   * Smart Question Flow: one analysis call decides whether the prompt is
   * already specific enough. Nothing is generated, no invitation is created,
   * and no generation progress is shown until it answers READY.
   */
  const runAnalysis = useCallback(
    async (
      originalPrompt: string,
      session: {
        originalPrompt: string;
        collectedData: SmartCollectedData;
        answers: SmartAnswer[];
      },
      controller: AbortController
    ) => {
      questionSessionRef.current = session;
      setQuestionDisabled(true);
      setQuestionPhase('ANALYZING_PROMPT');
      try {
        const analysis = await analyzeAiStudio({
          prompt: session.originalPrompt,
          collectedData: session.collectedData,
          answers: session.answers,
          lastQuestionId: session.answers.at(-1)?.questionId,
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (requestControllerRef.current === controller) requestControllerRef.current = null;
        setQuestionDisabled(false);

        if (analysis.status === 'READY') {
          setQuestion(null);
          setQuestionPhase('IDLE');
          questionSessionRef.current = null;
          await runGeneration(
            buildGenerationContext(originalPrompt, analysis.collectedData),
            controller
          );
          return;
        }
        // A real AI-generated question with real options: no timer, no stages.
        setQuestion(analysis.question);
        setQuestionPhase('WAITING_FOR_ANSWER');
      } catch (caught) {
        if (controller.signal.aborted) return;
        if (requestControllerRef.current === controller) requestControllerRef.current = null;
        setQuestionDisabled(false);
        setQuestionPhase('IDLE');
        setQuestion(null);
        questionSessionRef.current = null;
        if (caught instanceof ApiError && caught.status === 401) {
          router.replace('/login?next=%2Fdashboard%2Finvitations%2Fnew');
          return;
        }
        setMessages((current) => [
          ...current,
          {
            role: 'ai',
            text:
              caught instanceof ApiError
                ? caught.message
                : 'I could not read that just now. Please try again.',
          },
        ]);
      }
    },
    [router, runGeneration]
  );

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (
        text.length < 3 ||
        working ||
        questionPhase === 'ANALYZING_PROMPT' ||
        sendInFlight.current
      ) {
        if (text.length > 0 && text.length < 3) {
          setHint('Describe a little more.');
        }
        return;
      }
      setHint(null);
      setFailed(null);
      // A new request supersedes only this instance's previous one; other
      // users, sessions, and unrelated requests are untouched.
      requestControllerRef.current?.abort();
      progressStopRef.current?.();
      progressStopRef.current = null;
      const controller = new AbortController();
      requestControllerRef.current = controller;
      setMessages((current) => [...current, { role: 'user', text }]);
      // A brand-new conversation: drop any previous question session.
      const startingNew = question === null && questionPhase === 'IDLE';
      const session = startingNew
        ? { originalPrompt: text, collectedData: {}, answers: [] }
        : {
            originalPrompt: questionSessionRef.current?.originalPrompt ?? text,
            collectedData: questionSessionRef.current?.collectedData ?? {},
            answers: questionSessionRef.current?.answers ?? [],
          };
      setQuestionPhase(startingNew ? 'ANALYZING_PROMPT' : questionPhase);
      await runAnalysis(text, session, controller);
    },
    [question, questionPhase, runAnalysis, working]
  );

  /** One answer at a time; the AI then decides the next step itself. */
  const answerQuestion = useCallback(
    async (value: string | string[] | null) => {
      const session = questionSessionRef.current;
      const current = question;
      if (!session || !current) return;
      if (value === null || value === '' || (Array.isArray(value) && value.length === 0)) return;
      const answer: SmartAnswer = { questionId: current.id, value };
      const readable = Array.isArray(value) ? value.join(', ') : value;
      setMessages((current_) => [...current_, { role: 'user', text: readable }]);
      requestControllerRef.current?.abort();
      const controller = new AbortController();
      requestControllerRef.current = controller;
      setQuestion(null);
      await runAnalysis(
        readable,
        { ...session, answers: [...session.answers, answer] },
        controller
      );
    },
    [question, runAnalysis]
  );

  /** Leaving the question flow starts nothing and persists nothing. */
  const cancelQuestion = useCallback(() => {
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    questionSessionRef.current = null;
    setQuestion(null);
    setQuestionPhase('IDLE');
    setQuestionDisabled(false);
    setMessages((current) => [...current, { role: 'ai', text: 'Generation cancelled.' }]);
  }, []);

  const stop = useCallback(() => {
    // Real cancellation: close the SSE progress connection first so no
    // further stages render, then abort the active generation HTTP request.
    // The send() catch above turns the abort into the neutral idle state.
    progressStopRef.current?.();
    progressStopRef.current = null;
    requestControllerRef.current?.abort();
  }, []);

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

  /** The signed upload, shared by the in-design and the pending pre-generation paths. */
  const uploadIntoLibrary = useCallback(
    async (targetInvitationId: string, file: File) => {
      setUploading(true);
      setUploadProgress(0);
      setImageNotice(null);
      try {
        const target = await requestMediaUpload(targetInvitationId, {
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
        });
        await uploadToSignedTarget(target.uploadUrl, file, setUploadProgress);
        await completeMediaUpload(targetInvitationId, target.mediaId, {
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
        });
        const library = await listMedia(targetInvitationId);
        const previews: Record<string, string> = {};
        for (const item of library.items) {
          if (item.previewUrl) previews[item.id] = item.previewUrl;
        }
        setMediaPreviews((current) => ({ ...current, ...previews }));
        return `media://${target.mediaId}`;
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 401) {
          router.replace('/login?next=%2Fdashboard%2Finvitations%2Fnew');
          return null;
        }
        setImageNotice(caught instanceof ApiError ? caught.message : 'Upload failed. Try again.');
        return null;
      } finally {
        setUploading(false);
        setUploadProgress(null);
      }
    },
    [router]
  );

  const handleFile = useCallback(
    async (file: File) => {
      if (!invitationId || uploading) return;
      const invalid = validateMediaFile(file);
      if (invalid) {
        setImageNotice(invalid);
        return;
      }
      const mediaRef = await uploadIntoLibrary(invitationId, file);
      // Only the legacy designSpecification path can take a hero image; an artifact
      // has no spec to rewrite, so the file simply stays in the media library.
      if (mediaRef) await persistHeroImage(mediaRef);
    },
    [invitationId, uploading, uploadIntoLibrary, persistHeroImage]
  );

  /**
   * Attaching from the new chat happens before any invitation exists, and media is
   * owned by an invitation (POST /invitations/:id/media/uploads). So the file is
   * validated immediately and held, then uploaded for real as soon as the first
   * generation creates the invitation.
   */
  const handleAttachFile = useCallback(
    (file: File) => {
      if (uploading) return;
      const invalid = validateMediaFile(file);
      if (invalid) {
        setImageNotice(invalid);
        return;
      }
      setImageNotice(null);
      setPendingFile(file);
    },
    [uploading]
  );

  // The first generation mints the invitation that owns media, so drain the held
  // file into the real signed upload as soon as one exists.
  useEffect(() => {
    if (!pendingFile || !invitationId || uploading) return;
    let active = true;
    void (async () => {
      const mediaRef = await uploadIntoLibrary(invitationId, pendingFile);
      if (!active) return;
      if (mediaRef) {
        setPendingFile(null);
        setImageNotice('Photo attached to this invitation.');
      }
    })();
    return () => {
      active = false;
    };
  }, [pendingFile, invitationId, uploading, uploadIntoLibrary]);

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

  useEffect(() => {
    setPublishUrl(null);
  }, [invitationId]);

  const publishInvitation = useCallback(async () => {
    if (!invitationId || publishing || preview.status !== 'ready') return;
    setPublishing(true);
    try {
      const invitation = await updateInvitationPublication(invitationId, true);
      setPublishUrl(`${window.location.origin}/invite/${encodeURIComponent(invitation.slug)}`);
      setInvitationIsPublished(true);
      setPublishedDesignVersion(activeDesignVersion);
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : 'We could not publish this invitation.';
      setHint(message);
    } finally {
      setPublishing(false);
    }
  }, [activeDesignVersion, invitationId, publishing, preview.status]);

  const publicationPending = Boolean(
    invitationIsPublished &&
    activeDesignVersion !== null &&
    publishedDesignVersion !== null &&
    activeDesignVersion > publishedDesignVersion
  );

  return (
    <AiStudioView
      messages={messages}
      preview={preview}
      generationProgress={generationProgress}
      prompt={prompt}
      hint={hint}
      sendDisabled={working || questionPhase === 'ANALYZING_PROMPT' || prompt.trim().length < 3}
      sendLabel="Generate"
      suggestions={messages.length === 0 ? suggestions : []}
      onReloadSuggestions={reloadSuggestions}
      canReloadSuggestions={canReloadSuggestions}
      editorHref={editorHref}
      detailsHref={preview.status === 'ready' ? detailsHref : null}
      publishUrl={publishUrl}
      publishing={publishing}
      publicationPending={publicationPending}
      onPublish={() => void publishInvitation()}
      canEditDesign={Boolean(invitationId && websiteProject && preview.status === 'ready')}
      onRegenerateDesign={(instruction) => void regenerateDesign(instruction)}
      failedMessage={failed?.message ?? null}
      questionPhase={questionPhase}
      question={question}
      questionDisabled={questionDisabled}
      onQuestionAnswer={(value) => void answerQuestion(value)}
      onQuestionCancel={cancelQuestion}
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
      onAttachFile={handleAttachFile}
      canAttach={!uploading && !pendingFile}
      pendingUpload={
        pendingFile
          ? { name: pendingFile.name, size: pendingFile.size, type: pendingFile.type }
          : null
      }
      attachNotice={imageNotice}
      recentInvitations={recentInvitations}
      recentProjectsLoading={recentProjectsLoading}
      micSupported={micSupported}
      listening={listening}
      onToggleVoice={toggleVoiceInput}
      loggingOut={loggingOut}
      onLogout={onLogout}
      onPromptChange={setPrompt}
      onSend={() => void send(prompt)}
      onStop={stop}
      onSuggestion={(value) => {
        setPrompt(value);
        void send(value);
      }}
    />
  );
}
