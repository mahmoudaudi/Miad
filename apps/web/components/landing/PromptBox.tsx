'use client';

import { useRouter } from 'next/navigation';
import React, { useEffect, useRef, useState } from 'react';
import { getCurrentUser } from '@/lib/auth';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import {
  PENDING_PROMPT_AUTH_EVENT,
  savePendingInvitationPrompt,
} from '@/lib/pending-invitation-prompt';
import { PopularPrompts } from './PopularPrompts';
import { BTN_PRIMARY } from './theme';
import { TypewriterInput } from './TypewriterInput';

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ATTACHABLE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** Local-only guard for the inspiration-photo picker (no upload exists yet). */
export function isAttachableImage(file: { type: string; size: number }): boolean {
  return (
    (ATTACHABLE_IMAGE_TYPES as readonly string[]).includes(file.type) &&
    file.size > 0 &&
    file.size <= MAX_ATTACHMENT_BYTES
  );
}

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

/** Browser-native dictation when available; otherwise the mic stays hidden. */
function speechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const scoped = window as unknown as Record<string, unknown>;
  const ctor = scoped.SpeechRecognition ?? scoped.webkitSpeechRecognition ?? null;
  return typeof ctor === 'function' ? (ctor as unknown as SpeechRecognitionConstructor) : null;
}

/** Prompt box — suggestions fill the input; arrow submits, mic dictates. */
export function PromptBox() {
  const router = useRouter();
  const { locale } = useLocale();
  const t = getDictionary(locale).hero;
  const [value, setValue] = useState('');
  const [starting, setStarting] = useState(false);
  const [micSupported, setMicSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [attachment, setAttachment] = useState<{ url: string; name: string } | null>(null);
  const [attachError, setAttachError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  // Text confirmed before dictation started + finalized phrases since.
  const dictationBaseRef = useRef('');
  const dictationFinalRef = useRef('');

  // Feature-detect after mount so SSR and first render stay identical.
  useEffect(() => {
    setMicSupported(speechRecognitionConstructor() !== null);
    return () => {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    };
  }, []);

  // Release the local preview URL when the attachment changes or unmounts.
  useEffect(() => {
    const url = attachment?.url;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [attachment]);

  const selectPrompt = (prompt: string) => {
    setValue(prompt);
    inputRef.current?.focus();
  };

  const onAttachmentSelected = (file: File | null) => {
    setAttachError(null);
    if (!file) return;
    if (!isAttachableImage(file)) {
      setAttachError(t.attachError);
      return;
    }
    setAttachment((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return { url: URL.createObjectURL(file), name: file.name };
    });
    inputRef.current?.focus();
  };

  const removeAttachment = () => {
    setAttachment((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
    if (fileRef.current) fileRef.current.value = '';
  };

  const startInvite = async () => {
    if (starting) return;
    setStarting(true);
    try {
      const user = await getCurrentUser();
      // Stamp the prompt with its author when known so a later account on
      // this device can never auto-apply it.
      const saved = savePendingInvitationPrompt(value, user?.id ?? null);
      if (!saved) return;
      if (user) {
        router.push('/dashboard/invitations/new');
      } else {
        window.dispatchEvent(new Event(PENDING_PROMPT_AUTH_EVENT));
      }
    } catch {
      const saved = savePendingInvitationPrompt(value);
      if (saved) window.dispatchEvent(new Event(PENDING_PROMPT_AUTH_EVENT));
    } finally {
      setStarting(false);
    }
  };

  const toggleListening = () => {
    const Ctor = speechRecognitionConstructor();
    if (!Ctor) return;
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const recognition = new Ctor();
    recognitionRef.current = recognition;
    recognition.lang =
      typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en-US';
    recognition.interimResults = true;
    dictationBaseRef.current = value;
    dictationFinalRef.current = '';
    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result?.[0]?.transcript ?? '';
        if (!transcript) continue;
        if (result?.isFinal) {
          dictationFinalRef.current = dictationFinalRef.current
            ? `${dictationFinalRef.current} ${transcript}`
            : transcript;
        } else {
          interim = interim ? `${interim} ${transcript}` : transcript;
        }
      }
      const committed = dictationFinalRef.current.trim();
      const live = interim.trim();
      // Live words stream straight into the input; finalized phrases stick.
      setValue([dictationBaseRef.current.trim(), committed, live].filter(Boolean).join(' '));
      inputRef.current?.focus();
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    try {
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  return (
    <>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void startInvite();
        }}
        className="w-full max-w-2xl bg-surface p-2 rounded-2xl shadow-subtle border border-line flex items-center gap-2 transition-all focus-within:border-accent/60"
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          aria-hidden="true"
          tabIndex={-1}
          onChange={(event) => {
            onAttachmentSelected(event.target.files?.[0] ?? null);
            event.target.value = '';
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          aria-label={t.attachPhoto}
          title={t.attachPhoto}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted transition-all hover:bg-ink/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:h-9 sm:w-9"
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            add
          </span>
        </button>
        <div className="flex items-center ps-4 pe-1 w-full flex-1 min-w-0">
          <TypewriterInput
            ref={inputRef}
            value={value}
            onChange={setValue}
            ariaLabel={t.composerLabel}
            phrases={t.typewriterPhrases}
          />
        </div>
        {micSupported && (
          <button
            type="button"
            onClick={toggleListening}
            aria-label={listening ? t.stopDictation : t.dictate}
            aria-pressed={listening}
            title={t.dictate}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:h-9 sm:w-9 ${
              listening
                ? 'animate-pulse border-transparent bg-accent text-background'
                : 'text-muted hover:bg-ink/5 hover:text-ink'
            }`}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              mic
            </span>
          </button>
        )}
        <button
          type="submit"
          disabled={starting || value.trim().length === 0}
          aria-label={t.createInvitation}
          title={t.createInvitation}
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full sm:h-9 sm:w-9 ${BTN_PRIMARY} disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2`}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            arrow_upward
          </span>
        </button>
      </form>
      {attachment && (
        <div className="mt-3 flex w-full max-w-2xl items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={attachment.url} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
          <span className="min-w-0 flex-1 truncate text-body-sm text-ink" title={attachment.name}>
            {attachment.name}
          </span>
          <button
            type="button"
            onClick={removeAttachment}
            aria-label={t.removeAttachment}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-ink/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              close
            </span>
          </button>
        </div>
      )}
      {attachError && (
        <p role="alert" className="mt-3 text-body-sm text-error">
          {attachError}
        </p>
      )}
      {listening && (
        <p role="status" className="mt-3 text-body-sm text-accent">
          {t.listening}
        </p>
      )}
      <PopularPrompts
        prompts={t.promptPool}
        examplesLabel={t.examplePrompts}
        shuffleLabel={t.shufflePrompts}
        onSelect={selectPrompt}
      />
    </>
  );
}
