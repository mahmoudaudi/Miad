import Image from 'next/image';
import Link from 'next/link';
import React from 'react';
import type { HtmlDesignArtifact, InvitationDesignSpecification } from '@/lib/invitation-designs';
import { GenerationFailedNotice } from './GenerationFailedNotice';
import { HtmlInvitationFrame } from './HtmlInvitationFrame';
import { InvitationCanvas } from './InvitationCanvas';

export type StudioMessage = { role: 'user' | 'ai'; text: string };

export type StudioProfile = {
  name: string;
  email: string;
  initials: string;
};

export type StudioRecentInvitation = {
  id: string;
  title: string;
  eventDate: string;
};

export type StudioPreview =
  | { status: 'empty' }
  | { status: 'working' }
  | {
      status: 'ready';
      title: string;
      specification: InvitationDesignSpecification;
      renderUrl?: never;
    }
  | { status: 'ready'; title: string; artifact: HtmlDesignArtifact; renderUrl: string }
  | { status: 'failed' };

const workspaceLinks = [
  { href: '/dashboard/invitations/new', label: 'AI Studio', icon: 'auto_awesome' },
  { href: '/dashboard/invitations', label: 'Invitations', icon: 'mail' },
  { href: '/dashboard/community/browse', label: 'Community', icon: 'public' },
  { href: '/dashboard/community', label: 'My designs', icon: 'collections_bookmark' },
  { href: '/dashboard/events', label: 'Events', icon: 'event' },
  { href: '/dashboard/notifications', label: 'Notifications', icon: 'notifications' },
  { href: '/dashboard/billing', label: 'Billing', icon: 'payments' },
] as const;

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9f1239] focus-visible:ring-offset-1';

function WorkspaceNavigation() {
  return (
    <>
      <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6b7280]">
        Workspace
      </p>
      <nav aria-label="Workspace navigation" className="space-y-0.5">
        {workspaceLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`flex min-h-11 items-center gap-2.5 rounded-md px-2 text-[13px] font-medium text-[#4b5563] transition-colors hover:bg-[#e9edf2] hover:text-[#20242a] ${focusRing}`}
          >
            <span className="material-symbols-outlined text-[19px]" aria-hidden="true">
              {link.icon}
            </span>
            {link.label}
          </Link>
        ))}
      </nav>
    </>
  );
}

function MobileWorkspaceMenu({
  manualHref,
  profile,
}: {
  manualHref: string;
  profile: StudioProfile;
}) {
  return (
    <details className="group relative lg:hidden">
      <summary
        aria-label="Open workspace menu"
        className={`flex size-11 cursor-pointer list-none items-center justify-center rounded-md text-[#4b5563] transition-colors hover:bg-[#e5e7eb] hover:text-[#20242a] ${focusRing}`}
      >
        <span className="material-symbols-outlined text-[21px]" aria-hidden="true">
          menu
        </span>
      </summary>
      <div className="absolute end-0 top-12 z-50 w-[min(19rem,calc(100vw-1rem))] rounded-lg border border-[#d1d5db] bg-white p-2 shadow-[0_16px_40px_rgba(15,23,42,0.18)]">
        <div className="mb-2 flex items-center gap-2 border-b border-[#e5e7eb] px-2 py-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#9f1239] text-[11px] font-semibold text-white">
            {profile.initials}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-xs font-semibold text-[#20242a]">
              {profile.name}
            </span>
            <span className="block truncate text-[11px] text-[#6b7280]">{profile.email}</span>
          </span>
        </div>
        <WorkspaceNavigation />
        <div className="my-2 border-t border-[#e5e7eb]" />
        <Link
          href="/dashboard/invitations/new"
          aria-current="page"
          className={`flex min-h-11 items-center gap-2.5 rounded-md border border-[#fecdd3] bg-[#fff1f2] px-2 text-[13px] font-semibold text-[#9f1239] ${focusRing}`}
        >
          <span className="material-symbols-outlined text-[19px]" aria-hidden="true">
            auto_awesome
          </span>
          AI studio
        </Link>
        <Link
          href={manualHref}
          className={`mt-0.5 flex min-h-11 items-center gap-2.5 rounded-md px-2 text-[13px] font-medium text-[#4b5563] transition-colors hover:bg-[#f3f4f6] hover:text-[#20242a] ${focusRing}`}
        >
          <span className="material-symbols-outlined text-[19px] text-[#c2410c]" aria-hidden="true">
            edit_note
          </span>
          Manual event form
        </Link>
      </div>
    </details>
  );
}

export function StudioHeader({
  manualHref,
  profile,
  detailsHref,
  loggingOut,
  onLogout,
}: {
  manualHref: string;
  profile: StudioProfile;
  detailsHref: string | null;
  loggingOut?: boolean;
  onLogout?: () => void;
}) {
  const publishHref = detailsHref ?? '/dashboard/invitations';
  return (
    <header className="sticky top-0 z-40 grid h-11 grid-cols-[minmax(0,1fr)_auto] border-b border-[#cfd4da] bg-[#f3f4f6] lg:grid-cols-[minmax(180px,224px)_minmax(0,1fr)_auto] xl:grid-cols-[224px_430px_minmax(0,1fr)]">
      <Link
        href="/dashboard/invitations/new"
        aria-label="Open Miad workspace"
        className={`flex min-h-11 min-w-0 items-center gap-2 overflow-hidden border-e border-[#d7dbe0] px-3 ${focusRing}`}
      >
        <Image
          src="/miad-logo.png"
          alt=""
          width={150}
          height={100}
          className="h-7 w-auto shrink-0"
          priority
        />
        <span className="truncate text-xs font-semibold text-[#272b31]">Miad</span>
        <span className="text-[#6b7280]" aria-hidden="true">
          /
        </span>
        <span className="truncate text-xs text-[#5f6670]">AI Studio</span>
      </Link>
      <div className="hidden min-w-0 items-center gap-2 overflow-hidden border-e border-[#d7dbe0] px-3 text-xs text-[#6b7280] xl:flex">
        <div className="flex items-center rounded-md border border-[#d7dbe0] bg-[#e5e7eb] p-0.5">
          <Link
            href="/dashboard/invitations"
            className={`flex min-h-11 items-center rounded px-2.5 text-[11px] text-[#4b5563] hover:bg-white hover:text-[#20242a] ${focusRing}`}
          >
            Design
          </Link>
          <Link
            href="/dashboard/invitations/new"
            aria-current="page"
            className={`flex min-h-11 items-center gap-1 rounded bg-white px-2.5 text-[11px] font-semibold text-[#20242a] shadow-sm ${focusRing}`}
          >
            Build
            <span className="material-symbols-outlined text-[13px]" aria-hidden="true">
              expand_more
            </span>
          </Link>
        </div>
        <Link
          href={publishHref}
          aria-label="Open invitation preview"
          className={`flex size-11 items-center justify-center rounded-md text-[#047857] transition-colors hover:bg-[#d1fae5] ${focusRing}`}
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
            play_circle
          </span>
        </Link>
        <span className="h-4 w-px bg-[#d7dbe0]" aria-hidden="true" />
        <Link
          href={manualHref}
          className={`flex min-h-11 items-center gap-1.5 rounded-md px-2 text-[11px] font-medium text-[#4b5563] transition-colors hover:bg-[#e5e7eb] hover:text-[#20242a] ${focusRing}`}
        >
          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
            build
          </span>
          Tools
        </Link>
        <span className="flex min-h-11 items-center gap-1.5 rounded-md border border-[#d7dbe0] bg-[#e5e7eb] px-2.5 text-[11px] font-semibold text-[#343a42]">
          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
            desktop_windows
          </span>
          Preview
        </span>
      </div>
      <div className="flex min-w-0 shrink-0 items-center justify-end gap-1 px-1.5">
        <Link
          href="/dashboard/invitations"
          className={`hidden min-h-11 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-[#4b5563] transition-colors hover:bg-[#e5e7eb] md:flex ${focusRing}`}
        >
          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
            person_add
          </span>
          Invite
        </Link>
        <Link
          href={publishHref}
          className={`hidden min-h-11 items-center gap-1.5 rounded-md bg-[#9f1239] px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#881337] sm:flex ${focusRing}`}
        >
          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
            language
          </span>
          Publish
        </Link>
        <button
          type="button"
          onClick={onLogout}
          disabled={!onLogout || loggingOut}
          aria-label={loggingOut ? 'Logging out' : `Log out ${profile.name}`}
          title={profile.name}
          className={`hidden min-h-11 items-center gap-1.5 rounded-md px-1.5 transition-colors hover:bg-[#e5e7eb] disabled:cursor-wait disabled:opacity-60 sm:flex ${focusRing}`}
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#334155] text-[11px] font-semibold text-white">
            {profile.initials}
          </span>
          <span className="hidden max-w-24 truncate text-xs font-medium text-[#4b5563] 2xl:block">
            {profile.name}
          </span>
        </button>
        <MobileWorkspaceMenu manualHref={manualHref} profile={profile} />
      </div>
    </header>
  );
}

export function StudioSidebar({
  manualHref,
  profile,
  recentInvitations = [],
  loggingOut,
  onLogout,
}: {
  manualHref: string;
  profile: StudioProfile;
  recentInvitations?: StudioRecentInvitation[];
  loggingOut?: boolean;
  onLogout?: () => void;
}) {
  return (
    <aside
      aria-label="AI studio workspace"
      className="hidden min-h-0 w-[224px] flex-col border-e border-[#d7dbe0] bg-[#f8fafc] lg:flex"
    >
      <div className="flex items-center justify-between border-b border-[#e1e4e8] p-2">
        <Link
          href="/dashboard/invitations/new"
          aria-label="Open Miad overview"
          className={`flex size-9 items-center justify-center rounded-md text-[#c2410c] transition-colors hover:bg-[#e9edf2] ${focusRing}`}
        >
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
            grid_view
          </span>
        </Link>
        <Link
          href="/dashboard/invitations"
          aria-label="Search invitations"
          className={`flex size-9 items-center justify-center rounded-md text-[#6b7280] transition-colors hover:bg-[#e9edf2] hover:text-[#20242a] ${focusRing}`}
        >
          <span className="material-symbols-outlined text-[19px]" aria-hidden="true">
            search
          </span>
        </Link>
      </div>
      <div className="border-b border-[#e1e4e8] p-2">
        <Link
          href="/dashboard/invitations/new"
          className={`flex min-h-11 items-center gap-2 rounded-md px-2 text-xs font-semibold text-[#343a42] transition-colors hover:bg-[#e9edf2] ${focusRing}`}
        >
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#047857] text-[9px] font-semibold text-white">
            {profile.initials.charAt(0)}
          </span>
          <span className="min-w-0 truncate">Personal workspace</span>
          <span
            className="material-symbols-outlined ms-auto text-[16px] text-[#6b7280]"
            aria-hidden="true"
          >
            expand_more
          </span>
        </Link>
      </div>
      <div className="p-2">
        <Link
          href="/dashboard/invitations/new"
          className={`flex min-h-11 items-center gap-2 rounded-md px-2 text-xs font-semibold text-[#343a42] transition-colors hover:bg-[#e9edf2] ${focusRing}`}
        >
          <span className="material-symbols-outlined text-[18px] text-[#9f1239]" aria-hidden="true">
            add_circle
          </span>
          New invitation
        </Link>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2">
        <WorkspaceNavigation />
        <p className="mt-5 px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6b7280]">
          Creation
        </p>
        <Link
          href="/dashboard/invitations/new"
          aria-current="page"
          className={`flex min-h-11 items-center gap-2.5 rounded-md border border-[#fecdd3] bg-[#fff1f2] px-2 text-[13px] font-semibold text-[#9f1239] ${focusRing}`}
        >
          <span className="material-symbols-outlined text-[19px]" aria-hidden="true">
            auto_awesome
          </span>
          AI studio
        </Link>
        <Link
          href={manualHref}
          className={`mt-0.5 flex min-h-11 items-center gap-2.5 rounded-md px-2 text-[13px] font-medium text-[#4b5563] transition-colors hover:bg-[#e9edf2] hover:text-[#20242a] ${focusRing}`}
        >
          <span className="material-symbols-outlined text-[19px] text-[#c2410c]" aria-hidden="true">
            edit_note
          </span>
          Manual event form
        </Link>
        <p className="mt-5 px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6b7280]">
          Recent
        </p>
        {recentInvitations.length > 0 ? (
          <div className="space-y-1">
            {recentInvitations.map((invitation) => (
              <Link
                key={invitation.id}
                href={`/dashboard/invitations/${invitation.id}`}
                className={`block rounded-md px-2 py-2 text-xs text-[#343a42] transition-colors hover:bg-[#e5e7eb] ${focusRing}`}
              >
                <span className="block truncate font-semibold">{invitation.title}</span>
                <span className="mt-1 block truncate text-[11px] text-[#6b7280]">
                  {invitation.eventDate}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <Link
            href="/dashboard/invitations"
            className={`block rounded-md bg-[#e5e7eb] px-2 py-2 text-xs text-[#343a42] ${focusRing}`}
          >
            <span className="block font-semibold">No invitations yet</span>
            <span className="mt-1 block text-[11px] text-[#6b7280]">Create your first one</span>
          </Link>
        )}
      </div>
      <div className="space-y-2 border-t border-[#e1e4e8] p-2">
        <div className="rounded-lg border border-[#d7dbe0] bg-white p-2.5 shadow-sm">
          <p className="text-[11px] font-semibold text-[#343a42]">Your private workspace</p>
          <p className="mt-1 text-[10px] leading-4 text-[#6b7280]">
            Drafts stay private until you share them.
          </p>
        </div>
        <Link
          href="/dashboard/invitations/new"
          className={`flex min-h-11 items-center gap-2 rounded-md px-2 text-xs font-medium text-[#343a42] transition-colors hover:bg-[#e9edf2] ${focusRing}`}
        >
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#334155] text-[9px] font-semibold text-white">
            {profile.initials}
          </span>
          <span className="min-w-0 truncate">{profile.name}</span>
          <span
            className="material-symbols-outlined ms-auto text-[16px] text-[#6b7280]"
            aria-hidden="true"
          >
            settings
          </span>
        </Link>
      </div>
    </aside>
  );
}

export function AiStudioWorkspaceChrome({
  children,
  profile,
  loggingOut,
  onLogout,
}: {
  children: React.ReactNode;
  profile: StudioProfile;
  loggingOut: boolean;
  onLogout: () => void;
}) {
  return (
    <main className="min-h-[100dvh] bg-[#f5f0f1] text-[#2d1f23]">
      <StudioHeader
        manualHref="/dashboard/events/new"
        profile={profile}
        detailsHref={null}
        loggingOut={loggingOut}
        onLogout={onLogout}
      />
      <div className="lg:grid lg:min-h-[calc(100dvh-44px)] lg:grid-cols-[224px_minmax(0,1fr)]">
        <StudioSidebar manualHref="/dashboard/events/new" profile={profile} recentInvitations={[]} />
        <section className="min-w-0 bg-[#f5f0f1] px-3 py-4 sm:px-5 lg:px-8 lg:py-6">
          {children}
        </section>
      </div>
    </main>
  );
}

function EmptyConversation({
  suggestions,
  onSuggestion,
}: {
  suggestions: string[];
  onSuggestion: (value: string) => void;
}) {
  return (
    <div>
      <div className="rounded-lg border border-[#dbe1e8] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <span className="flex size-8 items-center justify-center rounded-md bg-[#fff7ed] text-[#c2410c]">
          <span className="material-symbols-outlined text-[19px]" aria-hidden="true">
            auto_awesome
          </span>
        </span>
        <h2 className="mt-3 text-sm font-semibold text-[#20242a]">What should Miad create?</h2>
        <p className="mt-1 text-[13px] leading-5 text-[#59616b]">
          Describe the occasion, mood, and guest experience. Miad will build the invitation and show
          it on the canvas.
        </p>
      </div>
      {suggestions.length > 0 && (
        <div className="mt-5">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6b7280]">
            Try an example
          </h3>
          <div className="mt-2 space-y-1.5">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => onSuggestion(suggestion)}
                className={`group flex min-h-11 w-full items-center gap-2 rounded-md border border-[#dbe1e8] bg-white px-3 py-2 text-start text-[13px] leading-5 text-[#343a42] transition-colors hover:border-[#fda4af] hover:bg-[#fff7f8] ${focusRing}`}
              >
                <span
                  className="material-symbols-outlined shrink-0 text-[18px] text-[#c2410c]"
                  aria-hidden="true"
                >
                  add
                </span>
                <span className="min-w-0 flex-1">{suggestion}</span>
                <span
                  className="material-symbols-outlined text-[17px] text-[#6b7280] transition-transform group-hover:translate-x-0.5 group-hover:text-[#9f1239]"
                  aria-hidden="true"
                >
                  arrow_forward
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MessageStream({
  messages,
  suggestions,
  failedMessage,
  editorHref,
  retrying,
  onSuggestion,
  onRetry,
  imageBar,
  showImageBar,
}: {
  messages: StudioMessage[];
  suggestions: string[];
  failedMessage: string | null;
  editorHref: string | null;
  retrying: boolean;
  onSuggestion: (value: string) => void;
  onRetry: () => void;
  imageBar: React.ReactNode;
  showImageBar: boolean;
}) {
  return (
    <div
      aria-live="polite"
      className="min-h-0 flex-1 space-y-3 overflow-visible px-3 py-4 lg:min-h-0 lg:overflow-y-auto"
    >
      {messages.length === 0 ? (
        <EmptyConversation suggestions={suggestions} onSuggestion={onSuggestion} />
      ) : (
        messages.map((message, index) => (
          <article
            key={`${message.role}-${index}`}
            className={`max-w-[92%] rounded-lg px-3 py-2.5 text-[13px] leading-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)] ${
              message.role === 'user'
                ? 'ms-auto bg-[#9f1239] text-white'
                : 'me-auto border border-[#dbe1e8] bg-white text-[#343a42]'
            }`}
          >
            <span className="sr-only">{message.role === 'user' ? 'You: ' : 'Miad: '}</span>
            {message.role === 'ai' && (
              <span className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#c2410c]">
                <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
                  auto_awesome
                </span>
                Miad
              </span>
            )}
            <span className="whitespace-pre-wrap break-words">{message.text}</span>
          </article>
        ))
      )}
      {failedMessage && editorHref && (
        <GenerationFailedNotice
          message={failedMessage}
          editorHref={editorHref}
          generating={retrying}
          onRetry={onRetry}
        />
      )}
      {showImageBar && imageBar}
    </div>
  );
}

function PromptComposer({
  prompt,
  hint,
  sendDisabled,
  sendLabel,
  working,
  onPromptChange,
  onSend,
  micSupported,
  listening,
  onToggleVoice,
}: {
  prompt: string;
  hint: string | null;
  sendDisabled: boolean;
  sendLabel: string;
  working: boolean;
  onPromptChange: (value: string) => void;
  onSend: () => void;
  micSupported: boolean;
  listening: boolean;
  onToggleVoice: () => void;
}) {
  return (
    <form
      className="border-t border-[#d7dbe0] bg-white p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!sendDisabled) onSend();
      }}
    >
      <label
        htmlFor="studio-prompt"
        className="mb-1.5 block text-[11px] font-semibold text-[#4b5563]"
      >
        Describe your invitation
      </label>
      <div className="rounded-lg border border-[#cfd4da] bg-white transition-colors focus-within:border-[#9f1239] focus-within:ring-2 focus-within:ring-[#9f1239]/15">
        <textarea
          id="studio-prompt"
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              if (!sendDisabled) onSend();
            }
          }}
          rows={3}
          maxLength={2000}
          aria-describedby={hint ? 'studio-prompt-hint' : undefined}
          placeholder="A rooftop birthday for Omar, sunset colors, 40 guests…"
          className="min-h-20 w-full resize-none rounded-t-lg bg-transparent px-3 py-2.5 text-base leading-5 text-[#20242a] outline-none placeholder:text-[#6b7280] lg:text-[13px]"
        />
        <div className="flex min-h-11 items-center justify-between gap-2 border-t border-[#e5e7eb] px-2">
          <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-[#6b7280]">
            <span
              className="material-symbols-outlined text-[16px] text-[#9f1239]"
              aria-hidden="true"
            >
              auto_awesome
            </span>
            <span className="truncate">Miad AI</span>
            {micSupported && (
              <button
                type="button"
                onClick={onToggleVoice}
                aria-label={listening ? 'Stop voice input' : 'Use voice input'}
                aria-pressed={listening}
                className={`ms-1 flex size-8 items-center justify-center rounded-md border ${
                  listening
                    ? 'border-[#fda4af] bg-[#fff1f2] text-[#9f1239]'
                    : 'border-transparent text-[#6b7280] hover:bg-[#f3f4f6]'
                } ${focusRing}`}
              >
                <span className="material-symbols-outlined text-[17px]" aria-hidden="true">
                  mic
                </span>
              </button>
            )}
          </span>
          <button
            type="submit"
            disabled={sendDisabled}
            aria-busy={working}
            className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-md bg-[#9f1239] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#881337] disabled:cursor-not-allowed disabled:opacity-45 ${focusRing}`}
          >
            {working ? (
              <span
                className="material-symbols-outlined animate-spin text-[17px]"
                aria-hidden="true"
              >
                progress_activity
              </span>
            ) : (
              <span className="material-symbols-outlined text-[17px]" aria-hidden="true">
                arrow_upward
              </span>
            )}
            {sendLabel}
          </button>
        </div>
      </div>
      {hint && (
        <p id="studio-prompt-hint" role="status" className="mt-1.5 text-xs text-[#9a3412]">
          {hint}
        </p>
      )}
    </form>
  );
}

function AgentPanel({
  messages,
  preview,
  prompt,
  hint,
  sendDisabled,
  sendLabel,
  suggestions,
  editorHref,
  failedMessage,
  retrying,
  imageBar,
  onPromptChange,
  onSend,
  onSuggestion,
  onRetry,
  micSupported,
  listening,
  onToggleVoice,
}: Pick<
  React.ComponentProps<typeof AiStudioView>,
  | 'messages'
  | 'preview'
  | 'prompt'
  | 'hint'
  | 'sendDisabled'
  | 'sendLabel'
  | 'suggestions'
  | 'editorHref'
  | 'failedMessage'
  | 'retrying'
  | 'imageBar'
  | 'onPromptChange'
  | 'onSend'
  | 'onSuggestion'
  | 'onRetry'
  | 'micSupported'
  | 'listening'
  | 'onToggleVoice'
>) {
  const showImageBar = preview.status === 'ready' && 'specification' in preview;
  return (
    <section
      aria-label="AI conversation"
      className="flex min-h-[42rem] min-w-0 flex-col border-e border-[#d7dbe0] bg-[#f8fafc] lg:h-full lg:min-h-0 lg:w-[430px] lg:shrink-0"
    >
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-[#d7dbe0] bg-[#f8fafc] px-3">
        <span className="flex size-6 items-center justify-center rounded bg-[#ffe4e6] text-[#9f1239]">
          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
            auto_awesome
          </span>
        </span>
        <h1 className="text-[13px] font-semibold text-[#272b31]">AI studio</h1>
        <span className="ms-auto text-[10px] font-medium uppercase tracking-[0.1em] text-[#6b7280]">
          Agent
        </span>
      </header>
      <MessageStream
        messages={messages}
        suggestions={suggestions}
        failedMessage={failedMessage}
        editorHref={editorHref}
        retrying={retrying}
        onSuggestion={onSuggestion}
        onRetry={onRetry}
        imageBar={imageBar}
        showImageBar={showImageBar}
      />
      <PromptComposer
        prompt={prompt}
        hint={hint}
        sendDisabled={sendDisabled}
        sendLabel={sendLabel}
        working={preview.status === 'working'}
        onPromptChange={onPromptChange}
        onSend={onSend}
        micSupported={micSupported ?? false}
        listening={listening ?? false}
        onToggleVoice={onToggleVoice ?? (() => undefined)}
      />
    </section>
  );
}

function CanvasPanel({
  preview,
  editorHref,
  detailsHref,
}: {
  preview: StudioPreview;
  editorHref: string | null;
  detailsHref: string | null;
}) {
  const ready = preview.status === 'ready';
  const legacy = ready && 'specification' in preview;
  return (
    <section
      aria-label="Live invitation preview"
      className="flex min-h-[40rem] min-w-0 flex-col bg-[#e5e7eb] lg:h-full lg:min-h-0"
    >
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-[#cfd4da] bg-[#f3f4f6] px-3">
        <span className="material-symbols-outlined text-[18px] text-[#59616b]" aria-hidden="true">
          desktop_windows
        </span>
        <h2 className="text-xs font-semibold text-[#343a42]">Canvas</h2>
        {ready && (
          <span className="min-w-0 truncate text-[11px] text-[#5f6670]">{preview.title}</span>
        )}
        <div className="ms-auto flex shrink-0 items-center gap-1">
          {legacy && editorHref && (
            <Link
              href={editorHref}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-md border border-[#cbd5e1] bg-white px-2.5 text-[11px] font-semibold text-[#3f4650] transition-colors hover:border-[#fda4af] hover:text-[#9f1239] ${focusRing}`}
            >
              <span className="material-symbols-outlined text-[17px]" aria-hidden="true">
                edit
              </span>
              Open editor
            </Link>
          )}
          {ready && detailsHref && (
            <Link
              href={detailsHref}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-md bg-[#9f1239] px-2.5 text-[11px] font-semibold text-white transition-colors hover:bg-[#881337] ${focusRing}`}
            >
              <span className="material-symbols-outlined text-[17px]" aria-hidden="true">
                open_in_new
              </span>
              View details
            </Link>
          )}
        </div>
      </header>
      <div className="flex min-h-0 flex-1 items-start justify-center overflow-auto p-3 sm:p-5">
        {preview.status === 'empty' && (
          <div className="flex min-h-[30rem] w-full max-w-[42rem] flex-col items-center justify-center rounded-lg border border-dashed border-[#aeb6c1] bg-[#edf0f3]/80 px-6 text-center">
            <span className="flex size-11 items-center justify-center rounded-md border border-[#fed7aa] bg-[#fff7ed] text-[#c2410c]">
              <span className="material-symbols-outlined text-[23px]" aria-hidden="true">
                web
              </span>
            </span>
            <h3 className="mt-3 text-sm font-semibold text-[#343a42]">
              Your invitation preview will appear here
            </h3>
            <p className="mt-1 max-w-sm text-[13px] leading-5 text-[#59616b]">
              Ask Miad for an occasion, mood, and guest experience. The generated invitation stays
              on this canvas.
            </p>
          </div>
        )}
        {preview.status === 'working' && (
          <div
            role="status"
            aria-busy="true"
            aria-label="Generating preview"
            className="min-h-[30rem] w-full max-w-[42rem] rounded-lg border border-[#cbd5e1] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.10)]"
          >
            <div className="flex items-center gap-2 border-b border-[#e5e7eb] pb-4">
              <span
                className="material-symbols-outlined animate-spin text-[20px] text-[#9f1239]"
                aria-hidden="true"
              >
                progress_activity
              </span>
              <p className="text-[13px] font-semibold text-[#343a42]">Creating your invitation…</p>
            </div>
            <div className="mt-5 animate-pulse rounded-md bg-[#e5e7eb] p-5">
              <div className="mx-auto h-3 w-24 rounded bg-[#cbd5e1]" />
              <div className="mx-auto mt-6 h-8 w-3/4 rounded bg-[#cbd5e1]" />
              <div className="mx-auto mt-3 h-3 w-1/2 rounded bg-[#d1d5db]" />
              <div className="mx-auto mt-10 h-3 w-2/3 rounded bg-[#d1d5db]" />
            </div>
          </div>
        )}
        {ready && 'artifact' in preview && (
          <HtmlInvitationFrame
            src={preview.renderUrl}
            title={preview.title}
            className="h-[68dvh] min-h-[30rem] max-h-[45rem] w-full max-w-[42rem] rounded-lg border border-[#cbd5e1] bg-white shadow-[0_12px_32px_rgba(15,23,42,0.12)]"
          />
        )}
        {ready && 'specification' in preview && (
          <InvitationCanvas
            specification={preview.specification}
            className="min-h-[30rem] w-full max-w-[42rem] border-[#cbd5e1] shadow-[0_12px_32px_rgba(15,23,42,0.12)]"
          />
        )}
        {preview.status === 'failed' && (
          <div className="flex min-h-[30rem] w-full max-w-[42rem] flex-col items-center justify-center rounded-lg border border-dashed border-[#fdba74] bg-[#fffaf5] px-6 text-center">
            <span className="flex size-11 items-center justify-center rounded-md bg-[#ffedd5] text-[#c2410c]">
              <span className="material-symbols-outlined text-[23px]" aria-hidden="true">
                warning
              </span>
            </span>
            <h3 className="mt-3 text-sm font-semibold text-[#343a42]">No preview yet</h3>
            <p className="mt-1 max-w-sm text-[13px] leading-5 text-[#59616b]">
              The invitation was created, but its design could not be generated. Retry from the
              agent panel or continue in the manual editor.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

export function AiStudioView({
  messages,
  preview,
  prompt,
  hint,
  sendDisabled,
  sendLabel,
  suggestions,
  editorHref,
  detailsHref,
  failedMessage,
  retrying,
  manualHref,
  imageBar,
  profile,
  recentInvitations = [],
  loggingOut,
  onLogout,
  micSupported,
  listening,
  onToggleVoice,
  onPromptChange,
  onSend,
  onSuggestion,
  onRetry,
}: {
  messages: StudioMessage[];
  preview: StudioPreview;
  prompt: string;
  hint: string | null;
  sendDisabled: boolean;
  sendLabel: string;
  suggestions: string[];
  editorHref: string | null;
  detailsHref: string | null;
  failedMessage: string | null;
  retrying: boolean;
  manualHref: string;
  imageBar: React.ReactNode;
  profile: StudioProfile;
  recentInvitations?: StudioRecentInvitation[];
  loggingOut?: boolean;
  onLogout?: () => void;
  onPromptChange: (value: string) => void;
  onSend: () => void;
  onSuggestion: (value: string) => void;
  onRetry: () => void;
  micSupported?: boolean;
  listening?: boolean;
  onToggleVoice?: () => void;
}) {
  return (
    <main
      id="ai-studio-content"
      tabIndex={-1}
      className="min-h-[100dvh] bg-[#f1f3f5] text-[#20242a] lg:h-[100dvh] lg:overflow-hidden"
    >
      <a
        href="#ai-studio-content"
        className="sr-only focus:not-sr-only focus:fixed focus:start-2 focus:top-2 focus:z-[60] focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-xs focus:font-semibold focus:text-[#9f1239]"
      >
        Skip to AI studio
      </a>
      <StudioHeader
        manualHref={manualHref}
        profile={profile}
        detailsHref={detailsHref}
        loggingOut={loggingOut}
        onLogout={onLogout}
      />
      <div className="lg:grid lg:h-[calc(100dvh-44px)] lg:grid-cols-[224px_430px_minmax(0,1fr)] lg:overflow-hidden">
        <StudioSidebar
          manualHref={manualHref}
          profile={profile}
          recentInvitations={recentInvitations}
        />
        <AgentPanel
          messages={messages}
          preview={preview}
          prompt={prompt}
          hint={hint}
          sendDisabled={sendDisabled}
          sendLabel={sendLabel}
          suggestions={suggestions}
          editorHref={editorHref}
          failedMessage={failedMessage}
          retrying={retrying}
          imageBar={imageBar}
          onPromptChange={onPromptChange}
          onSend={onSend}
          micSupported={micSupported ?? false}
          listening={listening ?? false}
          onToggleVoice={onToggleVoice ?? (() => undefined)}
          onSuggestion={onSuggestion}
          onRetry={onRetry}
        />
        <CanvasPanel preview={preview} editorHref={editorHref} detailsHref={detailsHref} />
      </div>
    </main>
  );
}
