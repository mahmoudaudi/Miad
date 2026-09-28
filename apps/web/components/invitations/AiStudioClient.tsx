'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDashboardSession, useWorkspaceActions } from '@/components/dashboard/DashboardShell';
import { ApiError } from '@/lib/api-client';
import {
  generateAiStudio,
  getAiStudioModels,
  readAiStudioModelPreference,
  saveAiStudioModelPreference,
  analyzeAiStudio,
  aiStudioProjectHref,
  aiStudioUrlWithoutInvitation,
  buildGenerationContext,
  captureAiStudioComposerSubmission,
  createAiGenerationId,
  getAiStudioProjectId,
  invitationDesignPreviewUrl,
  observeAiGeneration,
  refineAiStudio,
  resolveAiStudioRequestMode,
  resolveStudioSessionTransition,
  restoreAiStudioComposerSubmission,
  resolveInvitationImageElements,
  explicitlyRequestsUploadedImages,
  withHeroImage,
  type AiStudioResult,
  type AiGenerationProgress,
  type SmartAnswer,
  type SmartCollectedData,
  type SmartQuestion,
  type AiStudioModelOption,
  type AiStudioComposerSubmission,
} from '@/lib/ai-studio';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import {
  completePendingImageUpload,
  completeImageUpload,
  removeInvitationImage,
  removePendingImage,
  requestPendingImageUpload,
  requestImageUpload,
  uploadImageToSignedTarget,
  validateImageFile,
  type InvitationImage,
} from '@/lib/invitation-images';
import {
  completeInvitationSpecification,
  generateInvitationDesign,
  getInvitationDesign,
  saveInvitationEditor,
  refineInvitationDesign,
  type GeneratedWebsiteProject,
  type InvitationDesignSpecification,
} from '@/lib/invitation-designs';
import { applyCommunityDesign } from '@/lib/community';
import {
  clearPendingInvitationPrompt,
  readPendingInvitationPrompt,
} from '@/lib/pending-invitation-prompt';
import { getInvitation, listInvitations, updateInvitationPublication } from '@/lib/invitations';
import {
  AiStudioView,
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

function refinementSuccessMessage(title: string, instruction: string): string {
  const cleanInstruction = instruction.trim().replace(/\s+/g, ' ');
  const summary =
    cleanInstruction.length > 112
      ? `${cleanInstruction.slice(0, 109).trimEnd()}…`
      : cleanInstruction;
  return `Done. I updated “${title}” as requested: ${summary}`;
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
  const [modelOptions, setModelOptions] = useState<AiStudioModelOption[]>([]);
  const [modelPreference, setModelPreference] = useState('auto');
  const [modelSelectionLoading, setModelSelectionLoading] = useState(true);
  const [modelConfigurationLoaded, setModelConfigurationLoaded] = useState(false);
  const [messages, setMessages] = useState<StudioMessage[]>([]);
  const [preview, setPreview] = useState<StudioPreview>({ status: 'empty' });
  const [working, setWorking] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [failed, setFailed] = useState<{ invitationId: string; message: string } | null>(null);
  const [invitationId, setInvitationId] = useState<string | null>(null);
  const [projectLoading, setProjectLoading] = useState(false);
  const [spec, setSpec] = useState<InvitationDesignSpecification | null>(null);
  const [websiteProject, setWebsiteProject] = useState<GeneratedWebsiteProject | null>(null);
  const [generationProgress, setGenerationProgress] = useState<AiGenerationProgress | null>(null);
  const [eventType, setEventType] = useState<string | null>(null);
  const [imagePreviews, setImagePreviews] = useState<Record<string, string>>({});
  const [imageUrl, setImageUrl] = useState('');
  const [imageNotice, setImageNotice] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [attachedImages, setAttachedImages] = useState<
    Array<InvitationImage & { scope: 'pending' | 'invitation' }>
  >([]);
  const [recentInvitations, setRecentInvitations] = useState<StudioRecentInvitation[]>([]);
  const [recentProjectsLoading, setRecentProjectsLoading] = useState(true);
  const communitySlug = searchParams.get('community');
  const openedCommunityClone = searchParams.get('cloned') === '1';
  const selectedInvitationId = getAiStudioProjectId(searchParams);
  const [micSupported, setMicSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const autoSent = useRef(false);
  const loadedProjectIdRef = useRef<string | null>(null);
  // Identity that the currently loaded project state belongs to. Project
  // state must never survive an account switch without a reload.
  const loadedUserIdRef = useRef<string | null>(null);
  const sendInFlight = useRef(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const dictationBaseRef = useRef('');
  const dictationFinalRef = useRef('');
  const progressStopRef = useRef<(() => void) | null>(null);
  // Real cancellation, scoped to this studio instance's current request:
  // aborting this controller aborts the active generation HTTP request.
  const requestControllerRef = useRef<AbortController | null>(null);
  // Identity of the generation currently allowed to mutate the canvas. Stop
  // and a new run both advance it, so a response that resolves late belongs to
  // a run that no longer owns the UI and must be ignored.
  const runTokenRef = useRef(0);
  // The run that Stop has already reset the UI for, so the request's own abort
  // handler does not restore state (or announce cancellation) a second time.
  const cancelledRunRef = useRef<number | null>(null);
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
  const generationSubmissionRef = useRef<AiStudioComposerSubmission<
    InvitationImage & { scope: 'pending' | 'invitation' }
  > | null>(null);
  const [questionDisabled, setQuestionDisabled] = useState(false);

  useEffect(() => {
    let active = true;
    setModelSelectionLoading(true);
    void getAiStudioModels()
      .then((configuration) => {
        if (!active) return;
        setModelOptions(configuration.models);
        setModelPreference(readAiStudioModelPreference(user.id, configuration.models));
        setModelConfigurationLoaded(true);
      })
      .catch(() => {
        if (!active) return;
        setModelOptions([]);
        setModelPreference('auto');
        setModelConfigurationLoaded(true);
      })
      .finally(() => {
        if (active) setModelSelectionLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user.id]);

  useEffect(() => {
    if (!modelConfigurationLoaded) return;
    saveAiStudioModelPreference(user.id, modelPreference, modelOptions);
  }, [modelConfigurationLoaded, modelOptions, modelPreference, user.id]);

  const changeModelPreference = useCallback(
    (value: string) => {
      if (
        value === 'auto' ||
        modelOptions.some((option) => option.id === value && option.available)
      ) {
        setModelPreference(value);
      }
    },
    [modelOptions]
  );

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
    setRecentProjectsLoading(true);
    void listInvitations()
      .then((invitations) => {
        if (!active) return;
        setRecentInvitations(
          invitations.slice(0, 3).map((invitation) => ({
            id: invitation.id,
            title: invitation.event.title,
          }))
        );
      })
      .catch((caught) => {
        if (!active) return;
        // On identity change the previous account's list must not linger.
        setRecentInvitations([]);
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
  }, [router, user.id]);

  // Clears every piece of state derived from the loaded invitation so a
  // previous account's project, messages, canvas, or publish URL can never
  // linger. In-flight requests are aborted; their handlers already exit
  // early on abort instead of applying stale results.
  const resetProjectState = useCallback(() => {
    loadedProjectIdRef.current = null;
    requestControllerRef.current?.abort();
    progressStopRef.current?.();
    progressStopRef.current = null;
    sendInFlight.current = false;
    setWorking(false);
    setInvitationId(null);
    setSpec(null);
    setWebsiteProject(null);
    setMessages([]);
    setPreview({ status: 'empty' });
    setFailed(null);
    setPrompt('');
    setHint(null);
    setImageNotice(null);
    setImagePreviews({});
    setImageUrl('');
    setAttachedImages([]);
    setGenerationProgress(null);
    setPublishUrl(null);
    setInvitationIsPublished(false);
    setActiveDesignVersion(null);
    setPublishedDesignVersion(null);
    setEventType(null);
    setQuestion(null);
    setQuestionPhase('IDLE');
    questionSessionRef.current = null;
    generationSubmissionRef.current = null;
  }, []);

  // Binds loaded project state to the authenticated identity. When the
  // account changes underneath a mounted studio (logout/login, tab switch),
  // the previous account's state is dropped immediately and its invitationId
  // is stripped from the URL; any reload then goes through the owner-scoped
  // API, which rejects foreign invitation ids.
  useEffect(() => {
    const transition = resolveStudioSessionTransition(loadedUserIdRef.current, user.id);
    loadedUserIdRef.current = user.id;
    if (transition !== 'reset') return;
    resetProjectState();
    if (getAiStudioProjectId(searchParams)) {
      router.replace(aiStudioUrlWithoutInvitation(searchParams.toString()));
    }
  }, [user.id, router, searchParams, resetProjectState]);

  useEffect(() => {
    let active = true;
    if (!selectedInvitationId) {
      if (loadedProjectIdRef.current) {
        resetProjectState();
      }
      setProjectLoading(false);
      return () => {
        active = false;
      };
    }

    loadedProjectIdRef.current = selectedInvitationId;
    requestControllerRef.current?.abort();
    progressStopRef.current?.();
    progressStopRef.current = null;
    setProjectLoading(true);
    setInvitationId(null);
    setSpec(null);
    setWebsiteProject(null);
    setMessages([]);
    setPreview({ status: 'empty' });
    setFailed(null);
    setPrompt('');
    setHint(null);
    setImageNotice(null);
    setAttachedImages([]);
    setQuestion(null);
    setQuestionPhase('IDLE');
    questionSessionRef.current = null;
    generationSubmissionRef.current = null;
    setPublishUrl(null);
    setInvitationIsPublished(false);
    setActiveDesignVersion(null);
    setPublishedDesignVersion(null);
    setEventType(null);

    void Promise.all([
      getInvitation(selectedInvitationId),
      getInvitationDesign(selectedInvitationId),
    ])
      .then(([invitation, result]) => {
        if (!active) return;
        const design = result.design;
        const published = invitation.status === 'PUBLISHED' && Boolean(invitation.publishedAt);
        setInvitationId(invitation.id);
        setInvitationIsPublished(published);
        setActiveDesignVersion(design?.version ?? null);
        setPublishedDesignVersion(published ? (invitation.publishedDesignVersion ?? null) : null);
        if (published) {
          setPublishUrl(`${window.location.origin}/invite/${encodeURIComponent(invitation.slug)}`);
        }

        if (design && 'artifact' in design) {
          setWebsiteProject(design.project);
          setPreview({
            status: 'ready',
            title: design.artifact.title,
            artifact: design.artifact,
            renderUrl: invitationDesignPreviewUrl(invitation.id, design.version),
          });
          setMessages([
            {
              role: 'ai',
              text: openedCommunityClone
                ? `This is your independent copy of a Community design. Changes here will not affect the original. Your design is ready to edit.`
                : `Welcome back to “${invitation.event.title}.” Your saved design version ${design.version} is loaded. Describe what you would like to change.`,
            },
          ]);
          setFailed(null);
        } else if (design) {
          const specification = completeInvitationSpecification(design.designSpecification);
          setSpec(specification);
          setPreview({
            status: 'ready',
            title: specification.content.title || invitation.event.title,
            specification,
          });
          setMessages([
            {
              role: 'ai',
              text: openedCommunityClone
                ? `This is your independent copy of a Community design. Changes here will not affect the original. Your design is ready to edit.`
                : `Welcome back to “${invitation.event.title}.” Your saved design version ${design.version} is loaded. Describe what you would like to change.`,
            },
          ]);
          setFailed(null);
        } else {
          const message =
            'This project has no saved design yet. Describe the design you want to create.';
          setPreview({ status: 'failed' });
          setFailed(null);
          setMessages([{ role: 'ai', text: message }]);
        }
      })
      .catch((caught) => {
        if (!active) return;
        if (caught instanceof ApiError && caught.status === 401) {
          router.replace(
            `/login?next=${encodeURIComponent(`/dashboard/invitations/new?invitationId=${selectedInvitationId}`)}`
          );
          return;
        }
        const message =
          caught instanceof ApiError && caught.status !== 404 && caught.status !== 403
            ? 'This project could not be loaded. Please try again.'
            : 'This project is unavailable or you do not have access to it.';
        setPreview({ status: 'failed' });
        setFailed(null);
        setMessages([{ role: 'ai', text: message }]);
      })
      .finally(() => {
        if (active) setProjectLoading(false);
      });

    return () => {
      active = false;
    };
  }, [router, selectedInvitationId, openedCommunityClone, resetProjectState]);

  const applyResult = useCallback(
    (result: AiStudioResult, communitySpecification?: InvitationDesignSpecification) => {
      setInvitationId(result.invitation.id);
      setPublishUrl(null);
      setInvitationIsPublished(
        result.invitation.status === 'PUBLISHED' && Boolean(result.invitation.publishedAt)
      );
      setActiveDesignVersion(result.design?.version ?? null);
      setPublishedDesignVersion(result.invitation.publishedDesignVersion ?? null);
      // The invitation is the durable project identity. Keep it in the route
      // so refresh, navigation, and re-authentication reopen refinement mode.
      router.replace(aiStudioProjectHref(result.invitation.id));
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
          renderUrl: invitationDesignPreviewUrl(result.invitation.id, result.design.version),
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
    [router]
  );

  /**
   * The existing website generation step, unchanged: same endpoint, same SSE
   * progress, same Stop behaviour, same persistence. The Smart Question Flow
   * only ever decides *which* context string reaches it.
   */
  const runGeneration = useCallback(
    async (text: string, controller: AbortController) => {
      const submission = generationSubmissionRef.current
        ? { ...generationSubmissionRef.current, generationContext: text }
        : captureAiStudioComposerSubmission(prompt, text, attachedImages);
      generationSubmissionRef.current = submission;
      const explicitImageIds = explicitlyRequestsUploadedImages(text)
        ? submission.selectedImageIds
        : [];
      const restoreComposer = (claimedImageIds: string[] = []) => {
        const restored = restoreAiStudioComposerSubmission(submission, claimedImageIds);
        setPrompt(restored.prompt);
        setAttachedImages(restored.images);
      };
      requestControllerRef.current = controller;
      previewBeforeSendRef.current = preview;
      sendInFlight.current = true;
      setWorking(true);
      // This run owns the canvas until it is cancelled or a newer run starts.
      const runToken = (runTokenRef.current += 1);
      cancelledRunRef.current = null;
      // A response from an earlier run must never write to the canvas.
      const ownsCanvas = () => runTokenRef.current === runToken;
      setPrompt('');
      setAttachedImages([]);
      setPreview({
        status: 'working',
        operation: invitationId ? 'refine' : 'generate',
        ...(preview.status === 'ready' ? { previous: preview } : {}),
      });
      let stopProgress: (() => void) | null = null;
      let claimedImageIds = invitationId ? explicitImageIds : [];
      try {
        if (invitationId && websiteProject) {
          const generationId = createAiGenerationId();
          setGenerationProgress(null);
          stopProgress = observeAiGeneration(generationId, (update) => {
            // Wait for the refinement response before claiming the canvas is
            // updated. The server completion only confirms the version save.
            if (update.status === 'COMPLETED') return;
            setGenerationProgress(update);
          });
          progressStopRef.current = stopProgress;
          const design = await refineAiStudio(
            {
              invitationId,
              website: websiteProject,
              prompt: text,
              generationId,
              modelPreference: 'auto',
              imageIds: explicitImageIds,
            },
            controller.signal
          );
          if (controller.signal.aborted || !ownsCanvas()) {
            restoreComposer(claimedImageIds);
            return;
          }
          setSpec(null);
          setWebsiteProject(design.project);
          setActiveDesignVersion(design.version);
          setPreview({
            status: 'ready',
            title: design.artifact.title,
            artifact: design.artifact,
            renderUrl: invitationDesignPreviewUrl(invitationId, design.version),
          });
          setGenerationProgress((current) =>
            current?.operation === 'refinement'
              ? {
                  ...current,
                  stage: 'REFINEMENT_PREVIEW_UPDATED',
                  status: 'COMPLETED',
                  occurredAt: new Date().toISOString(),
                }
              : current
          );
          setMessages((current) => [
            ...current,
            { role: 'ai', text: refinementSuccessMessage(design.artifact.title, text) },
          ]);
          setFailed(null);
          generationSubmissionRef.current = null;
          questionSessionRef.current = null;
        } else if (invitationId) {
          const design = spec
            ? await refineInvitationDesign(invitationId, text, 'auto', controller.signal)
            : await generateInvitationDesign(
                invitationId,
                {
                  prompt: text,
                  mode: 'generate',
                  modelPreference: 'auto',
                },
                controller.signal
              );
          if (controller.signal.aborted || !ownsCanvas()) {
            restoreComposer(claimedImageIds);
            return;
          }
          const specification = completeInvitationSpecification(design.designSpecification);
          setSpec(specification);
          setWebsiteProject(null);
          setActiveDesignVersion(design.version);
          setPreview({
            status: 'ready',
            title: specification.content.title,
            specification,
          });
          setMessages((current) => [
            ...current,
            {
              role: 'ai',
              text: refinementSuccessMessage(specification.content.title, text),
            },
          ]);
          setFailed(null);
          generationSubmissionRef.current = null;
          questionSessionRef.current = null;
        } else {
          const generationId = createAiGenerationId();
          setGenerationProgress(null);
          stopProgress = observeAiGeneration(generationId, setGenerationProgress);
          progressStopRef.current = stopProgress;
          const result = await generateAiStudio(
            text,
            generationId,
            controller.signal,
            modelPreference,
            explicitImageIds
          );
          claimedImageIds = explicitImageIds;
          if (controller.signal.aborted || !ownsCanvas()) {
            restoreComposer(claimedImageIds);
            return;
          }
          const communitySpecification = communitySlug
            ? (await applyCommunityDesign(communitySlug, result.invitation.id)).designSpecification
            : undefined;
          if (controller.signal.aborted || !ownsCanvas()) {
            restoreComposer(claimedImageIds);
            return;
          }
          applyResult(result, communitySpecification);
          if (result.design || communitySpecification) {
            generationSubmissionRef.current = null;
            questionSessionRef.current = null;
          } else {
            restoreComposer(claimedImageIds);
          }
        }
      } catch (caught) {
        if (controller.signal.aborted) {
          // Stop already returned the UI to idle synchronously, so this handler
          // only has to close the listener. A repeated Stop, or an abort with no
          // user cancellation (a superseded run), must stay neutral and quiet.
          const alreadyCancelled = cancelledRunRef.current === runToken;
          cancelledRunRef.current = null;
          if (alreadyCancelled) return;
          if (stopProgress) {
            stopProgress();
            if (progressStopRef.current === stopProgress) progressStopRef.current = null;
          }
          setGenerationProgress(null);
          setPreview(previewBeforeSendRef.current);
          restoreComposer(claimedImageIds);
          setMessages((current) => [...current, { role: 'ai', text: 'Generation cancelled.' }]);
          return;
        }
        if (caught instanceof ApiError && caught.status === 401) {
          restoreComposer(claimedImageIds);
          const projectId = invitationId ?? selectedInvitationId;
          const projectHref = projectId
            ? aiStudioProjectHref(projectId)
            : '/dashboard/invitations/new';
          router.replace(`/login?next=${encodeURIComponent(projectHref)}`);
          return;
        }
        const safeMessage =
          caught instanceof ApiError
            ? caught.message
            : 'Something went wrong. Check your connection and try again.';
        setGenerationProgress((current) =>
          current?.operation === 'refinement' && current.status === 'ACTIVE'
            ? { ...current, status: 'FAILED', errorMessage: safeMessage }
            : current
        );
        if (stopProgress) {
          stopProgress();
          if (progressStopRef.current === stopProgress) progressStopRef.current = null;
        }
        setPreview(invitationId ? previewBeforeSendRef.current : { status: 'empty' });
        restoreComposer(claimedImageIds);
        setMessages((current) => [
          ...current,
          {
            role: 'ai',
            text: safeMessage,
          },
        ]);
        setFailed(null);
      } finally {
        if (requestControllerRef.current === controller) requestControllerRef.current = null;
        // A superseded run must not clear the state of the run that replaced it.
        if (ownsCanvas()) {
          sendInFlight.current = false;
          setWorking(false);
        }
      }
    },
    [
      applyResult,
      communitySlug,
      invitationId,
      preview,
      router,
      selectedInvitationId,
      spec,
      websiteProject,
      modelPreference,
      attachedImages,
      prompt,
    ]
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
          modelPreference: 'auto',
        });
        if (controller.signal.aborted) return;
        if (requestControllerRef.current === controller) requestControllerRef.current = null;
        setQuestionDisabled(false);

        if (analysis.status === 'READY') {
          setQuestion(null);
          setQuestionPhase('IDLE');
          await runGeneration(
            buildGenerationContext(
              session.originalPrompt || originalPrompt,
              analysis.collectedData,
              session.answers
            ),
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
        generationSubmissionRef.current = null;
        if (caught instanceof ApiError && caught.status === 401) {
          const projectHref = selectedInvitationId
            ? aiStudioProjectHref(selectedInvitationId)
            : '/dashboard/invitations/new';
          router.replace(`/login?next=${encodeURIComponent(projectHref)}`);
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
    [router, runGeneration, selectedInvitationId]
  );

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (
        text.length < 3 ||
        working ||
        projectLoading ||
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
      generationSubmissionRef.current = captureAiStudioComposerSubmission(
        text,
        text,
        attachedImages
      );
      const requestMode = resolveAiStudioRequestMode({
        invitationId: selectedInvitationId ?? invitationId,
        prompt: text,
        questionFlowActive: question !== null || questionPhase !== 'IDLE',
      });
      if (requestMode === 'existing-refinement') {
        questionSessionRef.current = null;
        setQuestion(null);
        setQuestionPhase('IDLE');
        setQuestionDisabled(false);
        await runGeneration(text, controller);
        return;
      }
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
    [
      invitationId,
      projectLoading,
      question,
      questionPhase,
      runAnalysis,
      runGeneration,
      selectedInvitationId,
      working,
      attachedImages,
    ]
  );

  /** One answer at a time; the AI then decides the next step itself. */
  const answerQuestion = useCallback(
    async (value: string | string[] | null) => {
      const session = questionSessionRef.current;
      const current = question;
      if (!session || !current) return;
      if (value === null || value === '' || (Array.isArray(value) && value.length === 0)) return;
      const answer: SmartAnswer = { questionId: current.id, question: current.text, value };
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
    generationSubmissionRef.current = null;
    setMessages((current) => [...current, { role: 'ai', text: 'Generation cancelled.' }]);
  }, []);

  const stop = useCallback(() => {
    // Stop is a user-visible action, so the UI must leave the generating state
    // now rather than whenever the aborted request happens to settle. Advancing
    // the run token first also revokes the in-flight run's permission to write
    // to the canvas, which is what stops a late response from re-rendering it.
    const stoppedRun = runTokenRef.current;
    runTokenRef.current += 1;
    cancelledRunRef.current = stoppedRun;

    // Close the SSE progress connection so no further stage renders.
    progressStopRef.current?.();
    progressStopRef.current = null;

    const controller = requestControllerRef.current;
    requestControllerRef.current = null;
    if (controller) controller.abort();
    else {
      // Nothing was in flight (a repeated Stop): stay idempotent and silent.
      cancelledRunRef.current = null;
      return;
    }

    sendInFlight.current = false;
    setWorking(false);
    setGenerationProgress(null);
    setPreview(previewBeforeSendRef.current);
    // The submitted prompt and its images stay in the composer so the user can
    // retry without retyping or re-uploading.
    const submission = generationSubmissionRef.current;
    if (submission) {
      const restored = restoreAiStudioComposerSubmission(submission, []);
      setPrompt(restored.prompt);
      setAttachedImages(restored.images);
    }
    setMessages((current) => [...current, { role: 'ai', text: 'Generation cancelled.' }]);
  }, []);

  const persistHeroImage = useCallback(
    async (imageRef: string, freshPreviews: Record<string, string> = {}) => {
      if (!spec || !invitationId) return;
      const previews = { ...imagePreviews, ...freshPreviews };
      const next = withHeroImage(spec, imageRef);
      try {
        const saved = await saveInvitationEditor(invitationId, next);
        setSpec(saved.designSpecification);
        setPreview({
          status: 'ready',
          title: saved.designSpecification.content.title,
          specification: resolveInvitationImageElements(saved.designSpecification, previews),
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
    [spec, invitationId, imagePreviews, router]
  );

  /** Store a photo used by an invitation design and return its stable design reference. */
  const uploadInvitationImage = useCallback(
    async (targetInvitationId: string, file: File) => {
      setUploading(true);
      setUploadProgress(0);
      setImageNotice(null);
      try {
        const target = await requestImageUpload(targetInvitationId, {
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
        });
        await uploadImageToSignedTarget(target.uploadUrl, file, setUploadProgress);
        const savedImage = await completeImageUpload(targetInvitationId, target.imageId, {
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
        });
        const preview = savedImage.previewUrl;
        const freshPreviews = preview ? { [target.imageId]: preview } : {};
        setImagePreviews((current) => ({ ...current, ...freshPreviews }));
        return `image://${target.imageId}`;
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
      const invalid = validateImageFile(file);
      if (invalid) {
        setImageNotice(invalid);
        return;
      }
      const imageRef = await uploadInvitationImage(invitationId, file);
      if (imageRef) await persistHeroImage(imageRef);
    },
    [invitationId, uploading, uploadInvitationImage, persistHeroImage]
  );

  const handleComposerFiles = useCallback(
    async (files: File[]) => {
      if (uploading) return;
      const available = Math.max(0, 5 - attachedImages.length);
      const selected = files.slice(0, available);
      if (!selected.length) {
        setImageNotice('You can attach up to 5 images.');
        return;
      }
      for (const file of selected) {
        const invalid = validateImageFile(file);
        if (invalid) {
          setImageNotice(invalid);
          return;
        }
      }
      setUploading(true);
      setUploadProgress(0);
      setImageNotice(null);
      try {
        const scope = invitationId ? 'invitation' : 'pending';
        for (const file of selected) {
          const metadata = { fileName: file.name, fileType: file.type, fileSize: file.size };
          const target = invitationId
            ? await requestImageUpload(invitationId, metadata)
            : await requestPendingImageUpload(metadata);
          await uploadImageToSignedTarget(target.uploadUrl, file, setUploadProgress);
          const saved = invitationId
            ? await completeImageUpload(invitationId, target.imageId, metadata)
            : await completePendingImageUpload(target.imageId, metadata);
          setAttachedImages((current) => [...current, { ...saved, scope }]);
        }
        setImageNotice(
          'Image ready. It will only be used when your prompt explicitly asks to use it.'
        );
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
    [attachedImages.length, invitationId, router, uploading]
  );

  const removeComposerImage = useCallback(
    async (imageId: string) => {
      const image = attachedImages.find((candidate) => candidate.id === imageId);
      if (!image) return;
      try {
        if (image.scope === 'invitation' && invitationId) {
          await removeInvitationImage(invitationId, imageId);
        } else {
          await removePendingImage(imageId);
        }
        setAttachedImages((current) => current.filter((candidate) => candidate.id !== imageId));
        setImageNotice('Image removed.');
      } catch (caught) {
        setImageNotice(caught instanceof ApiError ? caught.message : 'Could not remove image.');
      }
    },
    [attachedImages, invitationId]
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
    if (selectedInvitationId) return;
    // Owner-gated and consumed immediately: another account's prompt can
    // never auto-fire here, and this prompt cannot fire twice.
    const saved = readPendingInvitationPrompt(user.id);
    if (saved?.trim()) {
      clearPendingInvitationPrompt();
      setPrompt(saved.trim());
      void send(saved.trim());
    }
  }, [selectedInvitationId, send, user.id]);

  const studioHref = invitationId
    ? `/dashboard/invitations/new?invitationId=${encodeURIComponent(invitationId)}`
    : null;
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
      sendDisabled={
        projectLoading ||
        working ||
        questionPhase === 'ANALYZING_PROMPT' ||
        prompt.trim().length < 3
      }
      sendLabel={selectedInvitationId ? 'Update' : 'Generate'}
      suggestions={messages.length === 0 ? suggestions : []}
      onReloadSuggestions={reloadSuggestions}
      canReloadSuggestions={canReloadSuggestions}
      studioHref={studioHref}
      detailsHref={preview.status === 'ready' ? detailsHref : null}
      publishUrl={publishUrl}
      publishing={publishing}
      publicationPending={publicationPending}
      onPublish={() => void publishInvitation()}
      failedMessage={failed?.message ?? null}
      questionPhase={questionPhase}
      question={question}
      questionDisabled={questionDisabled}
      onQuestionAnswer={(value) => void answerQuestion(value)}
      onQuestionCancel={cancelQuestion}
      invitationsHref="/dashboard/invitations"
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
      recentProjectsLoading={recentProjectsLoading}
      projectLoading={projectLoading}
      micSupported={micSupported}
      listening={listening}
      onToggleVoice={toggleVoiceInput}
      modelOptions={modelOptions}
      modelPreference={modelPreference}
      modelSelectionLoading={modelSelectionLoading}
      modelSelectionOperation="generation"
      onModelPreferenceChange={changeModelPreference}
      imageUpload={{
        images: attachedImages,
        uploading,
        progress: uploadProgress,
        notice: imageNotice,
        disabled: working || projectLoading || questionPhase === 'ANALYZING_PROMPT',
        onFiles: (files) => void handleComposerFiles(files),
        onRemove: (imageId) => void removeComposerImage(imageId),
      }}
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
