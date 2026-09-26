import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { useState } from 'react';
import { AccountMenu } from '@/components/ui/AccountMenu';
import { Popover } from '@/components/ui/Popover';
import type { HtmlDesignArtifact, InvitationDesignSpecification } from '@/lib/invitation-designs';
import { GenerationFailedNotice } from './GenerationFailedNotice';
import { HtmlInvitationFrame } from './HtmlInvitationFrame';
import { InvitationCanvas } from './InvitationCanvas';
import { SmartQuestionCard } from './SmartQuestionCard';
import type { AiGenerationProgress, SmartQuestion } from '@/lib/ai-studio';

export type StudioMessage = { role: 'user' | 'ai'; text: string };

/** Smart Question Flow phase. Generation keeps its own existing state. */
export type StudioQuestionPhase = 'IDLE' | 'ANALYZING_PROMPT' | 'WAITING_FOR_ANSWER';

export type StudioProfile = {
  name: string;
  email: string;
  initials: string;
};

export type StudioRecentInvitation = {
  id: string;
  title: string;
  eventDate: string;
  createdAt: string;
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
  { href: '/dashboard/billing', label: 'Billing', icon: 'payments' },
] as const;

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9f1239] focus-visible:ring-offset-1';

const studioHref = '/dashboard/invitations/new';

/** AI Studio is nested under /dashboard/invitations but is its own destination, not an Invitations child. */
function isWorkspaceLinkActive(href: string, pathname: string | null): boolean {
  if (!pathname) return false;
  if (pathname === href) return true;
  if (!pathname.startsWith(`${href}/`)) return false;
  return !(href === '/dashboard/invitations' && pathname === studioHref);
}

function WorkspaceNavigation({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname();
  const navLinkClass = collapsed ? 'w-11 justify-center' : 'w-full gap-2.5 px-2 py-1.5';
  return (
    <nav
      aria-label="Workspace navigation"
      className={`space-y-0.5 text-xs text-[#52525b] ${collapsed ? 'flex flex-col items-center' : ''}`}
    >
      {workspaceLinks.map((link) => {
        const isActive = isWorkspaceLinkActive(link.href, pathname);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isActive ? 'page' : undefined}
            aria-label={collapsed ? link.label : undefined}
            title={collapsed ? link.label : undefined}
            className={`flex min-h-11 shrink-0 items-center rounded-md text-xs transition-colors ${focusRing} ${navLinkClass} ${
              isActive
                ? 'bg-[#f4f4f5] font-medium text-[#18181b]'
                : 'font-normal hover:bg-[#f4f4f5]/70 hover:text-[#27272a]'
            }`}
          >
            <span
              className={`material-symbols-outlined shrink-0 text-[16px] ${
                isActive ? 'text-[#9f1239]' : 'text-[#a1a1aa]'
              }`}
              aria-hidden="true"
            >
              {link.icon}
            </span>
            {!collapsed && <span className="min-w-0 truncate">{link.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

function MobileWorkspaceMenu({}: {}) {
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
      </div>
    </details>
  );
}

export function StudioHeader({
  manualHref,
  detailsHref,
}: {
  manualHref: string;
  detailsHref: string | null;
}) {
  const publishHref = detailsHref ?? '/dashboard/invitations';
  const pathname = usePathname();
  const studioTabs = [
    { href: '/dashboard/invitations', label: 'Design', chevron: false },
    { href: studioHref, label: 'Build', chevron: true },
  ] as const;
  return (
    <header className="sticky top-0 z-40 grid h-12 grid-cols-[minmax(0,1fr)_auto] border-b border-[#cfd4da] bg-[#f8fafc] lg:grid-cols-[224px_430px_minmax(0,1fr)]">
      {/* The brand mark lives in the sidebar; this column only reserves the sidebar's width. */}
      <div aria-hidden="true" className="hidden lg:block" />
      <div className="hidden min-w-0 items-center justify-between border-e border-[#d7dbe0] px-3.5 text-xs text-[#6b7280] lg:flex">
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border border-[#d7dbe0] bg-[#e5e7eb]/80 p-0.5">
            {studioTabs.map((tab) => {
              const isActive = isWorkspaceLinkActive(tab.href, pathname);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex h-7 items-center gap-1 rounded px-2.5 text-[11px] transition-colors ${focusRing} ${
                    isActive
                      ? 'bg-white font-semibold text-[#20242a] shadow-xs'
                      : 'font-medium text-[#4b5563] hover:bg-white hover:text-[#20242a]'
                  }`}
                >
                  {tab.label}
                  {tab.chevron && (
                    <span className="material-symbols-outlined text-[13px]" aria-hidden="true">
                      expand_more
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
          <Link
            href={publishHref}
            aria-label="Open invitation preview"
            title="Open invitation preview"
            className={`flex size-7 items-center justify-center rounded-md text-[#047857] transition-colors hover:bg-[#d1fae5] ${focusRing}`}
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              play_circle
            </span>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={manualHref}
            className={`flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] font-medium text-[#4b5563] transition-colors hover:bg-[#e9edf2] hover:text-[#20242a] ${focusRing}`}
          >
            <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
              build
            </span>
            Tools
          </Link>
          <span className="flex h-7 items-center gap-1.5 rounded-md border border-[#d7dbe0] bg-[#e5e7eb]/60 px-2.5 text-[11px] font-semibold text-[#343a42]">
            <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
              desktop_windows
            </span>
            Preview
          </span>
        </div>
      </div>
      <div className="flex min-w-0 shrink-0 items-center justify-end gap-2 px-3">
        <Link
          href="/dashboard/invitations"
          className={`hidden h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-[#4b5563] transition-colors hover:bg-[#e9edf2] hover:text-[#20242a] md:flex ${focusRing}`}
        >
          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
            person_add
          </span>
          Invite
        </Link>
        <Link
          href={publishHref}
          className={`hidden h-8 items-center gap-1.5 rounded-md bg-[#9f1239] px-3.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#881337] sm:flex ${focusRing}`}
        >
          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
            language
          </span>
          Publish
        </Link>
        <MobileWorkspaceMenu />
      </div>
    </header>
  );
}

/**
 * The sidebar renders narrow only when the user pinned it collapsed and is not
 * currently peeking it open. Hovering the profile must widen it without
 * overwriting the pinned choice, so these are two separate inputs.
 */
export function isSidebarNarrow(collapsed: boolean, peek: boolean): boolean {
  return collapsed && !peek;
}

export function StudioSidebar({
  manualHref,
  profile,
  loggingOut = false,
  onLogout,
}: {
  manualHref: string;
  profile: StudioProfile;
  loggingOut?: boolean;
  onLogout?: () => void;
}) {
  // `collapsed` is the state the user pinned with the toggle. `peek` is a transient
  // hover/focus reveal of the profile, so it can widen the sidebar without
  // overwriting that choice: leaving the profile narrows it again.
  const [collapsed, setCollapsed] = useState(false);
  const [peek, setPeek] = useState(false);
  const narrow = isSidebarNarrow(collapsed, peek);
  // Built outside JSX so the class attribute only ever carries real class names;
  // interpolating a ternary inline would leak `collapsed ? '…' : ''` as dead classes.
  const widthClass = narrow ? 'w-20' : 'w-[224px]';
  const logoRowClass = narrow
    ? 'group/logo flex min-h-11 items-center justify-center px-1.5 pb-3.5'
    : 'group/logo flex items-center px-1.5 pb-3.5';
  const logoClass = narrow ? 'size-6 object-contain' : 'h-6 w-auto';
  const toggleHitClass = narrow ? '-inset-x-2' : '';
  const newLinkClass = narrow ? 'justify-center px-0' : 'justify-start gap-2 px-3 py-1.5';
  const profileTriggerClass = narrow ? '!justify-center !px-0' : '!justify-between !px-2';
  return (
    <aside
      aria-label="AI studio workspace"
      data-collapsed={narrow ? 'true' : 'false'}
      className={`hidden min-h-0 shrink-0 flex-col overflow-hidden border-e border-[#ececee] bg-[#fbfbfb] transition-[width] duration-200 ease-out lg:flex ${widthClass}`}
    >
      <div className="miad-sidebar-scroll flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-3 pb-2 pt-3.5">
        {/* One slot, one control. The image stays in flow so it defines the row height
            and the control's box; the control is absolutely centred on that same box
            and is always hit-testable, so it works by mouse, touch and keyboard alike.
            The swap is hover-only in both states: the logo is always the resting face,
            and collapsing only narrows the sidebar. */}
        <div className={logoRowClass}>
          <div className="relative flex min-w-0 items-center">
            <Image
              src="/miad-logo.png"
              alt=""
              width={150}
              height={100}
              priority
              className={`shrink-0 opacity-100 transition-opacity duration-200 ease-out group-hover/logo:opacity-0 ${logoClass}`}
            />
            <button
              type="button"
              onClick={() => setCollapsed((value) => !value)}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!narrow}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className={`absolute inset-0 -inset-y-2 flex items-center justify-center rounded text-[#a1a1aa] transition-colors hover:bg-[#f4f4f5] hover:text-[#52525b] focus-visible:text-[#9f1239] ${toggleHitClass} ${focusRing}`}
            >
              <span
                className="material-symbols-outlined text-[17px] opacity-0 transition-opacity duration-200 ease-out group-hover/logo:opacity-100"
                aria-hidden="true"
              >
                {collapsed ? 'keyboard_double_arrow_right' : 'keyboard_double_arrow_left'}
              </span>
            </button>
          </div>
        </div>
        <div className="mb-4 px-0.5">
          <Link
            href="/dashboard/invitations/new"
            aria-label="New invitation"
            className={`flex min-h-11 w-full items-center rounded-lg border border-[#e4e4e7] bg-white text-xs font-medium text-[#27272a] shadow-sm transition hover:bg-[#fafafa] ${focusRing} ${newLinkClass}`}
          >
            <span
              className="flex size-4 shrink-0 items-center justify-center rounded-full bg-[#27272a] text-[11px] font-bold leading-none text-white"
              aria-hidden="true"
            >
              +
            </span>
            {!narrow && <span>New</span>}
          </Link>
        </div>
        <WorkspaceNavigation collapsed={narrow} />
      </div>
      {/* Hovering (or focusing) the profile peeks the full sidebar open. It widens to
          the right, so the profile stays under the cursor and the reveal is stable
          instead of oscillating. */}
      <div
        className="shrink-0 px-2.5 pb-2.5 pt-1"
        onMouseEnter={() => setPeek(true)}
        onMouseLeave={() => setPeek(false)}
        onFocus={() => setPeek(true)}
        onBlur={() => setPeek(false)}
      >
        <AccountMenu
          profile={profile}
          items="account"
          side="top"
          compact={narrow}
          loggingOut={loggingOut}
          onLogout={onLogout}
          triggerClassName={`w-full !min-h-11 !rounded-lg !py-1.5 text-xs !font-medium text-[#27272a] hover:!bg-[#f4f4f5] ${profileTriggerClass} ${focusRing}`}
        />
      </div>
    </aside>
  );
}

export function AiStudioWorkspaceChrome({
  children,
  profile,
  loggingOut = false,
  onLogout,
}: {
  children: React.ReactNode;
  profile: StudioProfile;
  loggingOut?: boolean;
  onLogout?: () => void;
}) {
  return (
    <main className="min-h-[100dvh] bg-[#f5f0f1] text-[#2d1f23]">
      <StudioHeader manualHref="/dashboard/events/new" detailsHref={null} />
      <div className="lg:grid lg:min-h-[calc(100dvh-48px)] lg:grid-cols-[auto_minmax(0,1fr)]">
        <StudioSidebar
          manualHref="/dashboard/events/new"
          profile={profile}
          loggingOut={loggingOut}
          onLogout={onLogout}
        />
        <section className="min-w-0 bg-[#f5f0f1] px-3 py-4 sm:px-5 lg:px-8 lg:py-6">
          {children}
        </section>
      </div>
    </main>
  );
}

const relativeTimeUnits: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 60 * 60 * 1000],
  ['month', 30 * 24 * 60 * 60 * 1000],
  ['week', 7 * 24 * 60 * 60 * 1000],
  ['day', 24 * 60 * 60 * 1000],
  ['hour', 60 * 60 * 1000],
  ['minute', 60 * 1000],
];

/** "2 hours ago" from the invitation's real createdAt, not a fixture. */
function formatRelativeSince(value: string, now: number): string {
  const created = Date.parse(value);
  if (Number.isNaN(created)) return '';
  const elapsed = now - created;
  if (elapsed < 60 * 1000) return 'just now';
  const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  for (const [unit, ms] of relativeTimeUnits) {
    if (elapsed >= ms) return relative.format(-Math.floor(elapsed / ms), unit);
  }
  return relative.format(-Math.floor(elapsed / 1000), 'second');
}

function RecentProjectCards({ invitations }: { invitations: StudioRecentInvitation[] }) {
  const now = Date.now();
  return (
    <section aria-labelledby="studio-recent-heading">
      <h3
        id="studio-recent-heading"
        className="mb-3 text-xs font-medium tracking-wide text-[#71717a]"
      >
        Recent projects
      </h3>
      {invitations.length === 0 ? (
        <p className="max-w-lg rounded-xl border border-dashed border-[#e4e4e7] bg-white/70 px-4 py-3 text-xs text-[#71717a]">
          Your invitations will appear here once you create your first one.
        </p>
      ) : (
        <ul className="grid max-w-3xl grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {invitations.map((invitation) => {
            const when = formatRelativeSince(invitation.createdAt, now);
            return (
              <li key={invitation.id}>
                <Link
                  href={`/dashboard/invitations/${invitation.id}`}
                  className={`flex h-[68px] flex-col justify-between rounded-xl border border-[#e4e4e7] bg-white/80 p-3 shadow-xs backdrop-blur-xs transition hover:border-[#d4d4d8] hover:shadow-sm ${focusRing}`}
                >
                  <span className="truncate text-xs font-semibold text-[#27272a]">
                    {invitation.title}
                  </span>
                  <span className="flex items-center gap-1.5 text-[10px] text-[#a1a1aa]">
                    <span
                      className="material-symbols-outlined shrink-0 text-[13px]"
                      aria-hidden="true"
                    >
                      calendar_today
                    </span>
                    <span className="truncate">{invitation.eventDate}</span>
                    {when && <span className="shrink-0">· {when}</span>}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

const ATTACH_ACCEPT = 'image/jpeg,image/png,image/webp';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Attachment panel for the new chat. Media is owned by an invitation, which does not
 * exist until the first generation, so a chosen file is validated here and held by
 * the client, then uploaded for real once that invitation appears.
 */
export function AttachPanel({
  onAttachFile,
  canAttach,
  pendingUpload = null,
  notice = null,
  id,
}: {
  onAttachFile?: (file: File) => void;
  canAttach: boolean;
  pendingUpload?: { name: string; size: number; type: string } | null;
  notice?: string | null;
  id: string;
}) {
  return (
    <section
      aria-label="Attach a photo"
      className="rounded-xl border border-[#e4e4e7] bg-white p-3"
    >
      {pendingUpload ? (
        <p className="flex items-center gap-2 text-[11px] text-[#3f3f46]">
          <span className="material-symbols-outlined text-[15px] text-[#9f1239]" aria-hidden="true">
            image
          </span>
          <span className="min-w-0 truncate font-medium">{pendingUpload.name}</span>
          <span className="shrink-0 text-[#a1a1aa]">{formatBytes(pendingUpload.size)}</span>
        </p>
      ) : (
        <label
          className={`flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-[#d4d4d8] px-3 text-[11px] font-medium text-[#52525b] transition-colors hover:border-[#a1a1aa] hover:bg-[#fafafa] ${
            canAttach ? '' : 'pointer-events-none opacity-50'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
            add_photo_alternate
          </span>
          Choose a photo
          <input
            id={id}
            type="file"
            accept={ATTACH_ACCEPT}
            disabled={!canAttach}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) onAttachFile?.(file);
            }}
            className="sr-only"
          />
        </label>
      )}
      <p className="mt-2 text-[10px] leading-4 text-[#a1a1aa]">
        JPEG, PNG or WebP, up to 6 MB.
        {pendingUpload && ' It uploads as soon as your first invitation is created.'}
      </p>
      {notice && (
        <p role="status" className="mt-1.5 text-[11px] text-[#9f1239]">
          {notice}
        </p>
      )}
    </section>
  );
}

function StudioLanding({
  firstName,
  suggestions,
  recentInvitations,
  onSuggestion,
  onReloadSuggestions,
  canReloadSuggestions,
  children,
}: {
  firstName: string;
  suggestions: string[];
  recentInvitations: StudioRecentInvitation[];
  onSuggestion: (value: string) => void;
  onReloadSuggestions?: () => void;
  canReloadSuggestions?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="miad-studio-glow flex flex-col overflow-y-auto px-5 py-7 sm:px-8 lg:px-10">
      <div className="mx-auto w-full max-w-3xl">
        <RecentProjectCards invitations={recentInvitations} />
      </div>
      <div className="mx-auto my-auto flex w-full max-w-2xl flex-col items-start py-10">
        <h1 className="mb-6 text-[26px] font-bold leading-tight tracking-tight text-[#18181b] sm:text-[31px]">
          {firstName
            ? `${firstName}, what are we working on today?`
            : 'What are we working on today?'}
        </h1>
        {suggestions.length > 0 && (
          <>
            <div className="mb-2.5 flex items-center gap-1.5">
              <h2 className="text-[11px] font-normal text-[#71717a]">Suggested for you</h2>
              {canReloadSuggestions && onReloadSuggestions && (
                <button
                  type="button"
                  onClick={onReloadSuggestions}
                  aria-label="Show different suggestions"
                  title="Show different suggestions"
                  className={`flex size-6 items-center justify-center rounded text-[#a1a1aa] transition-colors hover:bg-[#f4f4f5] hover:text-[#52525b] ${focusRing}`}
                >
                  <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                    refresh
                  </span>
                </button>
              )}
            </div>
            <div className="mb-3.5 flex flex-col flex-wrap items-start gap-2">
              {suggestions.map((suggestion, index) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => onSuggestion(suggestion)}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-full border border-[#e4e4e7] bg-white/90 px-3.5 py-1.5 text-xs font-normal text-[#3f3f46] shadow-xs transition hover:bg-white ${focusRing}`}
                >
                  <span
                    className="material-symbols-outlined text-[14px] text-[#9f1239]"
                    aria-hidden="true"
                  >
                    {index === 0 ? 'auto_awesome' : 'add'}
                  </span>
                  {suggestion}
                </button>
              ))}
            </div>
          </>
        )}
        {children}
      </div>
    </div>
  );
}

function MessageStream({
  messages,
  generationProgress,
  failedMessage,
  editorHref,
  imageBar,
  showImageBar,
  questionPhase,
  question,
  questionDisabled,
  onQuestionAnswer,
  onQuestionCancel,
}: {
  messages: StudioMessage[];
  generationProgress: AiGenerationProgress | null;
  failedMessage: string | null;
  editorHref: string | null;
  imageBar: React.ReactNode;
  showImageBar: boolean;
  questionPhase: StudioQuestionPhase;
  question: SmartQuestion | null;
  questionDisabled: boolean;
  onQuestionAnswer: (value: string | string[] | null) => void;
  onQuestionCancel: () => void;
}) {
  return (
    <div
      aria-live="polite"
      className="min-h-0 flex-1 space-y-3 overflow-visible px-3 py-4 lg:min-h-0 lg:overflow-y-auto"
    >
      {messages.map((message, index) => (
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
      ))}
      {/* While the assistant is asking, no generation progress is shown: the
          website pipeline has not started yet. */}
      {questionPhase === 'ANALYZING_PROMPT' && (
        <p
          role="status"
          aria-busy="true"
          className="me-auto flex max-w-[92%] items-center gap-2 rounded-lg border border-[#dbe1e8] bg-white px-3 py-2.5 text-[13px] text-[#343a42]"
        >
          <span
            className="material-symbols-outlined animate-spin text-[16px] text-[#9f1239]"
            aria-hidden="true"
          >
            progress_activity
          </span>
          Thinking about your invitation…
        </p>
      )}
      {question && questionPhase === 'WAITING_FOR_ANSWER' && (
        <SmartQuestionCard
          question={question}
          disabled={questionDisabled}
          onSubmit={onQuestionAnswer}
          onCancel={onQuestionCancel}
        />
      )}
      {!question && questionPhase !== 'ANALYZING_PROMPT' && generationProgress && (
        <GenerationProgress progress={generationProgress} />
      )}
      {failedMessage && editorHref && (
        <GenerationFailedNotice message={failedMessage} editorHref={editorHref} />
      )}
      {showImageBar && imageBar}
    </div>
  );
}

const progressLabels: Record<AiGenerationProgress['stage'], string> = {
  REQUEST_RECEIVED: 'Request received',
  ANALYZING_EVENT: 'Understanding your event',
  GENERATING_WEBSITE: 'Generating your website',
  PARSING_RESPONSE: 'Reading the website response',
  VALIDATING_WEBSITE: 'Checking the generated website',
  SAVING_WEBSITE: 'Saving your invitation',
  COMPLETED: 'Invitation ready',
};

const visibleProgressStages: AiGenerationProgress['stage'][] = [
  'ANALYZING_EVENT',
  'GENERATING_WEBSITE',
  'PARSING_RESPONSE',
  'VALIDATING_WEBSITE',
  'SAVING_WEBSITE',
];

function GenerationProgress({ progress }: { progress: AiGenerationProgress }) {
  const currentIndex = visibleProgressStages.indexOf(progress.stage);
  return (
    <section
      aria-live="polite"
      aria-label="Website generation progress"
      className="me-auto max-w-[92%] rounded-lg border border-[#dbe1e8] bg-white px-3 py-2.5 text-[12px] text-[#343a42] shadow-[0_1px_2px_rgba(15,23,42,0.05)]"
    >
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#c2410c]">
        Website generation
      </p>
      <ul className="space-y-1.5">
        {visibleProgressStages.map((stage, index) => {
          const isCurrent = stage === progress.stage;
          const isDone =
            progress.status === 'COMPLETED' || (currentIndex >= 0 && index < currentIndex);
          const isFailed = progress.status === 'FAILED' && isCurrent;
          return (
            <li key={stage} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={`text-[14px] ${
                  isFailed
                    ? 'text-[#b91c1c]'
                    : isDone
                      ? 'text-[#15803d]'
                      : isCurrent
                        ? 'text-[#c2410c]'
                        : 'text-[#94a3b8]'
                }`}
              >
                {isFailed ? '✕' : isDone ? '✓' : isCurrent ? '●' : '○'}
              </span>
              <span className={isCurrent ? 'font-semibold text-[#20242a]' : ''}>
                {progressLabels[stage]}
              </span>
            </li>
          );
        })}
      </ul>
      {progress.status === 'FAILED' && progress.errorMessage && (
        <p role="alert" className="mt-2 border-t border-[#fee2e2] pt-2 text-[#b91c1c]">
          {progress.errorMessage}
        </p>
      )}
    </section>
  );
}

function PromptComposer({
  prompt,
  hint,
  sendDisabled,
  sendLabel,
  working,
  variant = 'docked',
  onPromptChange,
  onSend,
  onStop,
  micSupported,
  listening,
  onToggleVoice,
  attachPanel,
  canAttach,
}: {
  prompt: string;
  hint: string | null;
  sendDisabled: boolean;
  sendLabel: string;
  working: boolean;
  variant?: 'docked' | 'card';
  onPromptChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  micSupported: boolean;
  listening: boolean;
  onToggleVoice: () => void;
  attachPanel?: React.ReactNode;
  canAttach?: boolean;
}) {
  const card = variant === 'card';
  return (
    <form
      className={
        card
          ? 'w-full rounded-2xl border border-[#e4e4e7] bg-white p-3.5 shadow-sm transition-shadow focus-within:shadow-md'
          : 'border-t border-[#d7dbe0] bg-white p-3'
      }
      onSubmit={(event) => {
        event.preventDefault();
        if (!sendDisabled) onSend();
      }}
    >
      {!card && (
        <label
          htmlFor="studio-prompt"
          className="mb-1.5 block text-[11px] font-semibold text-[#4b5563]"
        >
          Describe your invitation
        </label>
      )}
      {card && (
        <label htmlFor="studio-prompt" className="sr-only">
          Describe your invitation
        </label>
      )}
      <div
        className={
          card
            ? 'relative'
            : 'rounded-lg border border-[#cfd4da] bg-white transition-colors focus-within:border-[#9f1239] focus-within:ring-2 focus-within:ring-[#9f1239]/15'
        }
      >
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
          rows={card ? 2 : 3}
          maxLength={2000}
          aria-describedby={hint ? 'studio-prompt-hint' : undefined}
          placeholder={card ? undefined : 'A rooftop birthday for Omar, sunset colors, 40 guests…'}
          className={
            card
              ? 'block w-full resize-none bg-transparent px-0.5 py-0.5 text-[13px] leading-5 text-[#18181b] outline-none placeholder:text-[#a1a1aa]'
              : 'min-h-20 w-full resize-none rounded-t-lg bg-transparent px-3 py-2.5 text-base leading-5 text-[#20242a] outline-none placeholder:text-[#6b7280] lg:text-[13px]'
          }
        />
        {/* Shares the textarea's padding and line-height so the caret sits exactly on the
            text baseline instead of being pulled up with a negative margin. */}
        {card && !prompt && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute start-0.5 top-0.5 flex items-center text-[13px] leading-5 text-[#a1a1aa]"
          >
            <span className="miad-caret me-1" />
            Start chatting or describe a task…
          </span>
        )}
        <div
          className={
            card
              ? 'flex items-center justify-end gap-2 pt-4'
              : 'flex min-h-11 items-center justify-between gap-2 border-t border-[#e5e7eb] px-2'
          }
        >
          {card && attachPanel && (
            <Popover
              label="Attach a photo"
              side="top"
              align="start"
              className="miad-attach"
              triggerClassName={`!size-11 !min-h-11 !rounded-md !p-0 !text-[#a1a1aa] hover:!bg-[#f4f4f5] hover:!text-[#27272a] ${focusRing}`}
              trigger={
                <span
                  className="miad-attach-icon material-symbols-outlined text-[18px]"
                  aria-hidden="true"
                >
                  add
                </span>
              }
            >
              {attachPanel}
            </Popover>
          )}
          <span
            className={
              card
                ? 'ms-auto flex shrink-0 items-center gap-1'
                : 'flex min-w-0 items-center gap-1.5 text-[11px] text-[#6b7280]'
            }
          >
            {micSupported && (
              <button
                type="button"
                onClick={onToggleVoice}
                aria-label={listening ? 'Stop voice input' : 'Use voice input'}
                aria-pressed={listening}
                className={`flex size-11 items-center justify-center rounded-md transition-colors ${
                  listening
                    ? 'bg-[#fff1f2] text-[#9f1239]'
                    : 'text-[#a1a1aa] hover:bg-[#f4f4f5] hover:text-[#27272a]'
                } ${focusRing}`}
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                  mic
                </span>
              </button>
            )}
            <button
              type={working ? 'button' : 'submit'}
              onClick={working ? onStop : undefined}
              disabled={working ? false : sendDisabled}
              aria-busy={working}
              aria-label={working ? 'Stop generation' : card ? 'Send message' : sendLabel}
              title={working ? 'Stop generation' : undefined}
              className={`flex size-11 shrink-0 items-center justify-center rounded-md text-[#a1a1aa] transition-colors hover:bg-[#f4f4f5] hover:text-[#27272a] disabled:cursor-not-allowed disabled:opacity-45 ${focusRing}`}
            >
              {working ? (
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                  stop
                </span>
              ) : (
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                  arrow_upward
                </span>
              )}
            </button>
          </span>
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
  generationProgress,
  preview,
  prompt,
  hint,
  sendDisabled,
  sendLabel,
  editorHref,
  failedMessage,
  imageBar,
  questionPhase,
  question,
  questionDisabled,
  onQuestionAnswer,
  onQuestionCancel,
  onPromptChange,
  onSend,
  onStop,
  micSupported,
  listening,
  onToggleVoice,
}: Pick<
  React.ComponentProps<typeof AiStudioView>,
  | 'messages'
  | 'generationProgress'
  | 'preview'
  | 'prompt'
  | 'hint'
  | 'sendDisabled'
  | 'sendLabel'
  | 'editorHref'
  | 'failedMessage'
  | 'imageBar'
  | 'questionPhase'
  | 'question'
  | 'questionDisabled'
  | 'onQuestionAnswer'
  | 'onQuestionCancel'
  | 'onPromptChange'
  | 'onSend'
  | 'onStop'
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
        generationProgress={generationProgress ?? null}
        failedMessage={failedMessage}
        editorHref={editorHref}
        imageBar={imageBar}
        showImageBar={showImageBar}
        questionPhase={questionPhase ?? 'IDLE'}
        question={question ?? null}
        questionDisabled={questionDisabled ?? false}
        onQuestionAnswer={onQuestionAnswer ?? (() => undefined)}
        onQuestionCancel={onQuestionCancel ?? (() => undefined)}
      />
      <PromptComposer
        prompt={prompt}
        hint={hint}
        sendDisabled={sendDisabled}
        sendLabel={sendLabel}
        working={preview.status === 'working'}
        onPromptChange={onPromptChange}
        onSend={onSend}
        onStop={onStop}
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
              The invitation was created, but its design could not be generated. Submit a new prompt
              in the agent panel or continue in the manual editor.
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
  generationProgress = null,
  prompt,
  hint,
  sendDisabled,
  sendLabel,
  suggestions,
  editorHref,
  detailsHref,
  failedMessage,
  manualHref,
  imageBar,
  questionPhase = 'IDLE',
  question = null,
  questionDisabled = false,
  onQuestionAnswer,
  onQuestionCancel,
  profile,
  recentInvitations = [],
  micSupported,
  listening,
  loggingOut,
  onLogout,
  onToggleVoice,
  onPromptChange,
  onSend,
  onStop,
  onSuggestion,
  onReloadSuggestions,
  canReloadSuggestions,
  onAttachFile,
  canAttach = false,
  pendingUpload = null,
  attachNotice = null,
}: {
  messages: StudioMessage[];
  preview: StudioPreview;
  generationProgress?: AiGenerationProgress | null;
  prompt: string;
  hint: string | null;
  sendDisabled: boolean;
  sendLabel: string;
  suggestions: string[];
  editorHref: string | null;
  detailsHref: string | null;
  failedMessage: string | null;
  manualHref: string;
  imageBar: React.ReactNode;
  questionPhase?: StudioQuestionPhase;
  question?: SmartQuestion | null;
  questionDisabled?: boolean;
  onQuestionAnswer?: (value: string | string[] | null) => void;
  onQuestionCancel?: () => void;
  profile: StudioProfile;
  recentInvitations?: StudioRecentInvitation[];
  loggingOut?: boolean;
  onLogout?: () => void;
  onPromptChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  onSuggestion: (value: string) => void;
  onReloadSuggestions?: () => void;
  canReloadSuggestions?: boolean;
  onAttachFile?: (file: File) => void;
  canAttach?: boolean;
  pendingUpload?: { name: string; size: number; type: string } | null;
  attachNotice?: string | null;
  micSupported?: boolean;
  listening?: boolean;
  onToggleVoice?: () => void;
}) {
  const started = messages.length > 0;
  const sidebar = (
    <StudioSidebar
      manualHref={manualHref}
      profile={profile}
      loggingOut={loggingOut}
      onLogout={onLogout}
    />
  );
  // Rendered inside a Popover so it overlays the card instead of pushing it down
  // mid-click; a stacked panel moved the composer out from under the pointer.
  const attachPanel = onAttachFile ? (
    <AttachPanel
      id="studio-attach-input"
      onAttachFile={onAttachFile}
      canAttach={canAttach}
      pendingUpload={pendingUpload}
      notice={attachNotice}
    />
  ) : null;
  const composer = (
    <PromptComposer
      prompt={prompt}
      hint={hint}
      sendDisabled={sendDisabled}
      sendLabel={sendLabel}
      working={preview.status === 'working'}
      variant={started ? 'docked' : 'card'}
      attachPanel={attachPanel}
      canAttach={canAttach}
      onPromptChange={onPromptChange}
      onSend={onSend}
      onStop={onStop}
      micSupported={micSupported ?? false}
      listening={listening ?? false}
      onToggleVoice={onToggleVoice ?? (() => undefined)}
    />
  );
  return (
    <main
      id="ai-studio-content"
      tabIndex={-1}
      className={
        started
          ? 'min-h-[100dvh] bg-[#f1f3f5] text-[#20242a] lg:h-[100dvh] lg:overflow-hidden'
          : 'min-h-[100dvh] text-[#20242a] lg:h-[100dvh] lg:overflow-hidden'
      }
    >
      <a
        href="#ai-studio-content"
        className="sr-only focus:not-sr-only focus:fixed focus:start-2 focus:top-2 focus:z-[60] focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-xs focus:font-semibold focus:text-[#9f1239]"
      >
        Skip to AI studio
      </a>
      {!started ? (
        <>
          {/* The new chat has nothing to publish, so the publishing bar stays hidden.
              Mobile keeps the disclosure because the sidebar is desktop-only. */}
          <div className="flex h-12 items-center justify-end border-b border-[#ececee] bg-[#fbfbfb] px-3 lg:hidden">
            <MobileWorkspaceMenu />
          </div>
          <div className="lg:grid lg:h-[100dvh] lg:grid-cols-[auto_minmax(0,1fr)] lg:overflow-hidden">
            {sidebar}
            <StudioLanding
              firstName={profile.name.split(' ')[0]?.trim() ?? ''}
              suggestions={suggestions}
              recentInvitations={recentInvitations}
              onSuggestion={onSuggestion}
              onReloadSuggestions={onReloadSuggestions}
              canReloadSuggestions={canReloadSuggestions}
            >
              {composer}
            </StudioLanding>
          </div>
        </>
      ) : (
        <>
          <StudioHeader manualHref={manualHref} detailsHref={detailsHref} />
          <div className="lg:grid lg:h-[calc(100dvh-48px)] lg:grid-cols-[auto_430px_minmax(0,1fr)] lg:overflow-hidden">
            {sidebar}
            <AgentPanel
              messages={messages}
              generationProgress={generationProgress}
              preview={preview}
              prompt={prompt}
              hint={hint}
              sendDisabled={sendDisabled}
              sendLabel={sendLabel}
              editorHref={editorHref}
              failedMessage={failedMessage}
              imageBar={imageBar}
              questionPhase={questionPhase}
              question={question}
              questionDisabled={questionDisabled}
              onQuestionAnswer={onQuestionAnswer ?? (() => undefined)}
              onQuestionCancel={onQuestionCancel ?? (() => undefined)}
              onPromptChange={onPromptChange}
              onSend={onSend}
              onStop={onStop}
              micSupported={micSupported ?? false}
              listening={listening ?? false}
              onToggleVoice={onToggleVoice ?? (() => undefined)}
            />
            <CanvasPanel preview={preview} editorHref={editorHref} detailsHref={detailsHref} />
          </div>
        </>
      )}
    </main>
  );
}
