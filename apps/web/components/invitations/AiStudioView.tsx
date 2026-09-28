import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccountMenu } from '@/components/ui/AccountMenu';
import { ShareButton } from '@/components/ui/ShareButton';
import { ApiError } from '@/lib/api-client';
import { aiStudioProjectHref } from '@/lib/ai-studio';
import { listInvitations, type InvitationRecord } from '@/lib/invitations';
import type { HtmlDesignArtifact, InvitationDesignSpecification } from '@/lib/invitation-designs';
import { GenerationFailedNotice } from './GenerationFailedNotice';
import { HtmlInvitationFrame } from './HtmlInvitationFrame';
import { InvitationCanvas } from './InvitationCanvas';
import { SmartQuestionCard } from './SmartQuestionCard';
import type { AiGenerationProgress, SmartQuestion } from '@/lib/ai-studio';
import type { AiStudioModelOption } from '@/lib/ai-studio';

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
};

export type StudioImageUpload = {
  images: Array<{ id: string; fileName: string; previewUrl: string | null }>;
  uploading: boolean;
  progress: number | null;
  notice: string | null;
  disabled: boolean;
  onFiles: (files: File[]) => void;
  onRemove: (imageId: string) => void;
};

export type StudioReadyPreview =
  | {
      status: 'ready';
      title: string;
      specification: InvitationDesignSpecification;
      renderUrl?: never;
    }
  | { status: 'ready'; title: string; artifact: HtmlDesignArtifact; renderUrl: string };

export type StudioPreview =
  | { status: 'empty' }
  | { status: 'working'; operation?: 'generate' | 'refine'; previous?: StudioReadyPreview }
  | StudioReadyPreview
  | { status: 'failed' };

const workspaceLinks = [
  { href: '/dashboard/invitations/new', label: 'AI Studio', icon: 'auto_awesome' },
  { href: '/dashboard/invitations', label: 'Invitations', icon: 'mail' },
  { href: '/dashboard/community/browse', label: 'Community', icon: 'public' },
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

type SidebarProject = { id: string; title: string };

export type MyProjectsState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; projects: SidebarProject[] };

export function studioProjectHref(invitationId: string): string {
  return aiStudioProjectHref(invitationId);
}

export function isStudioProjectActive(
  pathname: string | null,
  activeInvitationId: string | null,
  projectId: string
): boolean {
  return pathname?.replace(/\/+$/, '') === studioHref && activeInvitationId === projectId;
}

export function MyProjectsList({
  state,
  pathname,
  activeInvitationId,
  collapsed,
  onRetry,
}: {
  state: MyProjectsState;
  pathname: string | null;
  activeInvitationId: string | null;
  collapsed: boolean;
  onRetry: () => void;
}) {
  return (
    <section
      aria-labelledby="my-projects-heading"
      className="mt-5 min-h-0 border-t border-[#e5e7eb] pt-4"
    >
      <h2
        id="my-projects-heading"
        className={`mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#71717a] ${collapsed ? 'sr-only' : ''}`}
      >
        MY PROJECTS
      </h2>
      {state.status === 'loading' && (
        <ul aria-label="Loading projects" className="max-h-56 space-y-1 overflow-y-auto">
          {[0, 1, 2].map((index) => (
            <li key={index} className="flex min-h-9 items-center gap-2 rounded-md px-2">
              <span className="size-4 shrink-0 animate-pulse rounded bg-[#e5e7eb]" />
              {!collapsed && <span className="h-3 w-3/4 animate-pulse rounded bg-[#e5e7eb]" />}
            </li>
          ))}
        </ul>
      )}
      {state.status === 'error' && (
        <div className={`px-2 py-2 text-[11px] text-[#71717a] ${collapsed ? 'text-center' : ''}`}>
          {!collapsed && <p role="alert">{state.message}</p>}
          <button
            type="button"
            onClick={onRetry}
            aria-label="Retry loading projects"
            title="Retry loading projects"
            className={`mt-1 rounded px-1.5 py-1 font-medium text-[#9f1239] transition-colors hover:bg-[#f4f4f5] ${focusRing}`}
          >
            {collapsed ? '↻' : 'Retry'}
          </button>
        </div>
      )}
      {state.status === 'ready' && state.projects.length === 0 && (
        <p className={`px-2 py-2 text-[11px] text-[#71717a] ${collapsed ? 'sr-only' : ''}`}>
          No projects yet.
        </p>
      )}
      {state.status === 'ready' && state.projects.length > 0 && (
        <ul
          aria-label="My projects"
          className="max-h-56 space-y-1 overflow-y-auto overscroll-contain"
        >
          {state.projects.map((project) => {
            const active = isStudioProjectActive(pathname, activeInvitationId, project.id);
            return (
              <li key={project.id}>
                <Link
                  href={studioProjectHref(project.id)}
                  aria-current={active ? 'page' : undefined}
                  aria-label={project.title}
                  title={project.title}
                  className={`flex min-h-9 items-center gap-2 rounded-md px-2 text-[11px] transition-colors ${focusRing} ${
                    active
                      ? 'bg-[#e5e7eb] font-semibold text-[#20242a]'
                      : 'font-normal text-[#52525b] hover:bg-[#f4f4f5] hover:text-[#20242a]'
                  } ${collapsed ? 'justify-center' : ''}`}
                >
                  <span
                    className={`material-symbols-outlined shrink-0 text-[16px] ${
                      active ? 'text-[#9f1239]' : 'text-[#a1a1aa]'
                    }`}
                    aria-hidden="true"
                  >
                    mail
                  </span>
                  {!collapsed && <span className="min-w-0 truncate">{project.title}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function useMyProjects() {
  const [state, setState] = useState<MyProjectsState>({ status: 'loading' });
  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const invitations: InvitationRecord[] = await listInvitations();
      setState({
        status: 'ready',
        projects: invitations.map((invitation) => ({
          id: invitation.id,
          title: invitation.event.title,
        })),
      });
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        if (typeof window !== 'undefined') {
          window.location.replace('/login?next=%2Fdashboard%2Finvitations%2Fnew');
        }
        return;
      }
      setState({
        status: 'error',
        message: caught instanceof ApiError ? caught.message : 'Projects could not be loaded.',
      });
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return { state, load };
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
  invitationsHref,
  detailsHref,
  publishUrl = null,
  publishing = false,
  publicationPending = false,
  onPublish = () => undefined,
}: {
  invitationsHref: string;
  detailsHref: string | null;
  publishUrl?: string | null;
  publishing?: boolean;
  publicationPending?: boolean;
  onPublish?: () => void;
}) {
  const publishHref = detailsHref ?? '/dashboard/invitations';
  const pathname = usePathname();
  const studioTabs = [
    { href: '/dashboard/invitations', label: 'Invitations', chevron: false },
    { href: studioHref, label: 'AI Studio', chevron: true },
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
            href={invitationsHref}
            className={`flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] font-medium text-[#4b5563] transition-colors hover:bg-[#e9edf2] hover:text-[#20242a] ${focusRing}`}
          >
            <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
              build
            </span>
            Invitations
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
        {detailsHref && (!publishUrl || publicationPending) && (
          <button
            type="button"
            onClick={onPublish}
            disabled={publishing}
            className={`hidden h-8 items-center gap-1.5 rounded-md bg-[#9f1239] px-3.5 text-xs font-semibold text-white shadow-xs transition duration-200 ease-out hover:-translate-y-px hover:bg-[#881337] hover:shadow-sm active:translate-y-0 disabled:opacity-60 sm:flex ${focusRing}`}
          >
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
              language
            </span>
            {publishing ? 'Publishing…' : publicationPending ? 'Publish update' : 'Publish'}
          </button>
        )}
        {detailsHref && publishUrl && (
          <Link
            href={publishUrl}
            target="_blank"
            rel="noreferrer"
            className={`hidden h-8 items-center gap-1.5 rounded-md bg-[#047857] px-3.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#065f46] sm:flex ${focusRing}`}
          >
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
              open_in_new
            </span>
            Open invitation
          </Link>
        )}
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
  profile,
  loggingOut = false,
  onLogout,
}: {
  profile: StudioProfile;
  loggingOut?: boolean;
  onLogout?: () => void;
}) {
  // `collapsed` is the state the user pinned with the toggle. `peek` is a transient
  // hover/focus reveal of the profile, so it can widen the sidebar without
  // overwriting that choice: leaving the profile narrows it again.
  const [collapsed, setCollapsed] = useState(false);
  const [peek, setPeek] = useState(false);
  const pathname = usePathname();
  const activeInvitationId = useSearchParams()?.get('invitationId') ?? null;
  const { state: projectsState, load: reloadProjects } = useMyProjects();
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
            aria-label="Create an invitation with AI"
            className={`flex min-h-11 w-full items-center rounded-lg border border-[#e4e4e7] bg-white text-xs font-medium text-[#27272a] shadow-sm transition hover:bg-[#fafafa] ${focusRing} ${newLinkClass}`}
          >
            <span
              className="flex size-4 shrink-0 items-center justify-center rounded-full bg-[#27272a] text-[11px] font-bold leading-none text-white"
              aria-hidden="true"
            >
              +
            </span>
            {!narrow && <span>Create with AI</span>}
          </Link>
        </div>
        <WorkspaceNavigation collapsed={narrow} />
        <MyProjectsList
          state={projectsState}
          pathname={pathname}
          activeInvitationId={activeInvitationId}
          collapsed={narrow}
          onRetry={() => void reloadProjects()}
        />
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
  showHeader = true,
  loggingOut = false,
  onLogout,
}: {
  children: React.ReactNode;
  profile: StudioProfile;
  showHeader?: boolean;
  loggingOut?: boolean;
  onLogout?: () => void;
}) {
  return (
    <main className="miad-studio-theme min-h-[100dvh] bg-[#f1f3f5] text-[#20242a]">
      {showHeader ? (
        <StudioHeader invitationsHref="/dashboard/invitations" detailsHref={null} />
      ) : (
        <div className="flex h-12 items-center justify-end border-b border-[#ececee] bg-[#fbfbfb] px-3 lg:hidden">
          <MobileWorkspaceMenu />
        </div>
      )}
      <div
        className={`lg:grid lg:grid-cols-[auto_minmax(0,1fr)] ${
          showHeader ? 'lg:min-h-[calc(100dvh-48px)]' : 'lg:min-h-[100dvh]'
        }`}
      >
        <StudioSidebar profile={profile} loggingOut={loggingOut} onLogout={onLogout} />
        <section className="min-w-0 bg-[#f1f3f5] px-3 py-4 sm:px-5 lg:px-8 lg:py-6">
          {children}
        </section>
      </div>
    </main>
  );
}

function RecentProjectTitles({
  invitations,
  loading,
}: {
  invitations: StudioRecentInvitation[];
  loading: boolean;
}) {
  return (
    <section aria-labelledby="studio-recent-heading" aria-busy={loading}>
      <h3
        id="studio-recent-heading"
        className="mb-3 text-center text-xs font-medium tracking-wide text-[#71717a]"
      >
        Recent projects
      </h3>
      {loading ? (
        <ul aria-label="Loading recent projects" className="flex max-w-full gap-3 overflow-hidden">
          {[0, 1, 2].map((index) => (
            <li
              key={index}
              className="flex min-h-12 w-[min(58vw,13rem)] shrink-0 items-center rounded-lg border border-[#e4e4e7] bg-white px-3"
            >
              <span className="h-3 w-40 animate-pulse rounded bg-[#e5e7eb]" />
            </li>
          ))}
        </ul>
      ) : invitations.length === 0 ? (
        <div className="max-w-5xl border-t border-[#ececee] py-3 text-xs text-[#71717a]">
          No projects yet.
        </div>
      ) : (
        <ul className="flex max-w-full gap-3 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:justify-center">
          {invitations.slice(0, 3).map((invitation) => (
            <li key={invitation.id} className="w-[min(58vw,13rem)] shrink-0">
              <Link
                href={studioProjectHref(invitation.id)}
                aria-label={`Open ${invitation.title}`}
                className={`flex min-h-12 items-center rounded-lg border border-[#e4e4e7] bg-white px-3 text-xs font-medium text-[#27272a] shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-[#d4d4d8] hover:shadow-md ${focusRing}`}
              >
                <span className="min-w-0 truncate">{invitation.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function StudioLanding({
  firstName,
  suggestions,
  recentInvitations,
  recentProjectsLoading,
  onSuggestion,
  onReloadSuggestions,
  canReloadSuggestions,
  children,
}: {
  firstName: string;
  suggestions: string[];
  recentInvitations: StudioRecentInvitation[];
  recentProjectsLoading: boolean;
  onSuggestion: (value: string) => void;
  onReloadSuggestions?: () => void;
  canReloadSuggestions?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="miad-studio-glow flex flex-col overflow-y-auto px-5 py-7 sm:px-8 lg:px-10">
      <div className="mx-auto w-full max-w-5xl">
        <RecentProjectTitles invitations={recentInvitations} loading={recentProjectsLoading} />
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
  studioHref,
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
  studioHref: string | null;
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
          className={`${index === messages.length - 1 ? 'miad-feedback-enter' : ''} max-w-[92%] rounded-lg px-3 py-2.5 text-[13px] leading-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)] ${
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
      {failedMessage && studioHref && (
        <GenerationFailedNotice message={failedMessage} studioHref={studioHref} />
      )}
      {showImageBar && imageBar}
    </div>
  );
}

const progressLabels: Record<AiGenerationProgress['stage'], string> = {
  REQUEST_RECEIVED: 'Request received',
  ANALYZING_EVENT: 'Understanding your event',
  GENERATING_WEBSITE: 'Generating your design with Stitch',
  PARSING_RESPONSE: 'Reading your Stitch design',
  VALIDATING_WEBSITE: 'Checking and sanitizing your design',
  SAVING_WEBSITE: 'Saving your invitation',
  REFINEMENT_UNDERSTANDING: 'Understanding your request',
  REFINEMENT_INSPECTING: 'Inspecting the current invitation',
  REFINEMENT_APPLYING: 'Applying the requested changes',
  REFINEMENT_VALIDATING: 'Validating the updated design',
  REFINEMENT_SAVING: 'Saving the new invitation version',
  REFINEMENT_PREVIEW_UPDATED: 'Updating the preview',
  COMPLETED: 'Invitation ready',
};

const visibleProgressStages: AiGenerationProgress['stage'][] = [
  'ANALYZING_EVENT',
  'GENERATING_WEBSITE',
  'PARSING_RESPONSE',
  'VALIDATING_WEBSITE',
  'SAVING_WEBSITE',
];
const visibleRefinementStages: AiGenerationProgress['stage'][] = [
  'REFINEMENT_UNDERSTANDING',
  'REFINEMENT_INSPECTING',
  'REFINEMENT_APPLYING',
  'REFINEMENT_VALIDATING',
  'REFINEMENT_SAVING',
  'REFINEMENT_PREVIEW_UPDATED',
];

function GenerationProgress({ progress }: { progress: AiGenerationProgress }) {
  const isRefinement =
    progress.operation === 'refinement' || progress.stage.startsWith('REFINEMENT_');
  const stages = isRefinement ? visibleRefinementStages : visibleProgressStages;
  const currentIndex = stages.indexOf(progress.stage);
  return (
    <section
      aria-live="polite"
      aria-label={isRefinement ? 'Invitation refinement progress' : 'Website generation progress'}
      className="me-auto max-w-[92%] rounded-lg border border-[#dbe1e8] bg-white px-3 py-2.5 text-[12px] text-[#343a42] shadow-[0_1px_2px_rgba(15,23,42,0.05)]"
    >
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#c2410c]">
        {isRefinement ? 'Updating your invitation' : 'Website generation'}
      </p>
      <ul className="space-y-1.5">
        {stages.map((stage, index) => {
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
                {stage === 'COMPLETED' && isRefinement
                  ? 'Invitation updated'
                  : progressLabels[stage]}
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

export function ModelPicker({
  modelOptions,
  modelPreference,
  modelSelectionLoading,
  modelSelectionOperation,
  onModelPreferenceChange,
  initialOpen = false,
}: {
  modelOptions: AiStudioModelOption[];
  modelPreference: string;
  modelSelectionLoading: boolean;
  modelSelectionOperation: AiStudioModelOption['operations'][number];
  onModelPreferenceChange: (value: string) => void;
  initialOpen?: boolean;
}) {
  const [open, setOpen] = useState(initialOpen);
  const rootRef = useRef<HTMLDivElement>(null);
  const eligible = modelOptions.filter((model) =>
    model.operations.includes(modelSelectionOperation)
  );
  const selected =
    modelPreference === 'auto' ? null : eligible.find((model) => model.id === modelPreference);
  const label = modelPreference === 'auto' ? 'Auto' : (selected?.name ?? modelPreference);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function choose(value: string) {
    onModelPreferenceChange(value);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        disabled={modelSelectionLoading}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Choose AI model"
        title="Choose AI model"
        className={`inline-flex h-8 max-w-44 items-center gap-1 rounded-full border border-[#d7dbe0] bg-[#f8fafc] px-2.5 text-[12px] font-medium text-[#343a42] transition hover:bg-[#f4f4f5] focus:outline-none focus:ring-2 focus:ring-[#9f1239]/15 disabled:cursor-wait disabled:opacity-60`}
      >
        <span
          className="material-symbols-outlined shrink-0 text-[16px] text-[#9f1239]"
          aria-hidden="true"
        >
          auto_awesome
        </span>
        <span className="truncate">{modelSelectionLoading ? '…' : label}</span>
        <span
          className="material-symbols-outlined shrink-0 text-[16px] text-[#6b7280]"
          aria-hidden="true"
        >
          expand_more
        </span>
      </button>
      {open && (
        <div
          role="listbox"
          aria-label="AI models"
          className="absolute bottom-full left-0 z-50 mb-2 max-h-64 w-64 overflow-y-auto rounded-xl border border-[#d7dbe0] bg-white p-1 shadow-lg"
        >
          <button
            type="button"
            role="option"
            aria-selected={modelPreference === 'auto'}
            onClick={() => choose('auto')}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-start transition hover:bg-[#f4f4f5]"
          >
            <span
              className="material-symbols-outlined shrink-0 text-[16px] text-[#9f1239]"
              aria-hidden="true"
            >
              auto_awesome
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-semibold text-[#27272a]">Auto</span>
              <span className="block truncate text-[11px] text-[#6b7280]">
                Let Stitch choose automatically
              </span>
            </span>
            {modelPreference === 'auto' && (
              <span
                className="material-symbols-outlined shrink-0 text-[16px] text-[#9f1239]"
                aria-hidden="true"
              >
                check
              </span>
            )}
          </button>
          {eligible.map((model) => {
            const isSelected = modelPreference === model.id;
            return (
              <button
                key={model.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={!model.available}
                onClick={() => choose(model.id)}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-start transition hover:bg-[#f4f4f5] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span
                  className="material-symbols-outlined shrink-0 text-[16px] text-[#9f1239]"
                  aria-hidden="true"
                >
                  neurology
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-semibold text-[#27272a]">
                    {model.name}
                    {model.tier === 'premium' ? ' · Premium' : ''}
                    {!model.available ? ' · Unavailable' : ''}
                  </span>
                  <span className="block truncate text-[11px] text-[#6b7280]">
                    {model.description}
                  </span>
                </span>
                {isSelected && (
                  <span
                    className="material-symbols-outlined shrink-0 text-[16px] text-[#9f1239]"
                    aria-hidden="true"
                  >
                    check
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
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
  modelOptions,
  modelPreference,
  modelSelectionLoading,
  modelSelectionOperation,
  onModelPreferenceChange,
  imageUpload,
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
  modelOptions: AiStudioModelOption[];
  modelPreference: string;
  modelSelectionLoading: boolean;
  modelSelectionOperation: AiStudioModelOption['operations'][number];
  onModelPreferenceChange: (value: string) => void;
  imageUpload?: StudioImageUpload | null;
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
        {imageUpload && imageUpload.images.length > 0 && (
          <ul aria-label="Selected images" className="flex gap-2 overflow-x-auto p-2 pb-0">
            {imageUpload.images.map((image) => (
              <li
                key={image.id}
                className="relative size-16 shrink-0 overflow-hidden rounded-lg border border-[#d7dbe0] bg-[#f4f4f5]"
              >
                {image.previewUrl ? (
                  // Signed previews are short-lived and intentionally never persisted.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={image.previewUrl}
                    alt={image.fileName}
                    className="size-full object-cover"
                  />
                ) : (
                  <span className="flex size-full items-center justify-center text-[#71717a]">
                    <span className="material-symbols-outlined" aria-hidden="true">
                      image
                    </span>
                  </span>
                )}
                <button
                  type="button"
                  aria-label={`Remove ${image.fileName}`}
                  onClick={() => imageUpload.onRemove(image.id)}
                  disabled={imageUpload.disabled || imageUpload.uploading}
                  className="absolute end-1 top-1 flex size-6 items-center justify-center rounded-full bg-black/70 text-white disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                    close
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
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
          {imageUpload && (
            <label
              aria-label="Add images"
              title="Add images"
              className={`flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-[#71717a] transition-colors hover:bg-[#f4f4f5] hover:text-[#27272a] ${imageUpload.disabled || imageUpload.uploading || imageUpload.images.length >= 5 ? 'pointer-events-none opacity-45' : ''} ${focusRing}`}
            >
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                add
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="sr-only"
                disabled={
                  imageUpload.disabled || imageUpload.uploading || imageUpload.images.length >= 5
                }
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  event.target.value = '';
                  if (files.length) imageUpload.onFiles(files);
                }}
              />
            </label>
          )}
          <span
            className={
              card
                ? 'ms-auto flex shrink-0 items-center gap-1'
                : 'flex min-w-0 items-center gap-1.5 text-[11px] text-[#6b7280]'
            }
          >
            <ModelPicker
              modelOptions={modelOptions}
              modelPreference={modelPreference}
              modelSelectionLoading={modelSelectionLoading}
              modelSelectionOperation={modelSelectionOperation}
              onModelPreferenceChange={onModelPreferenceChange}
            />
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
      {imageUpload?.uploading && imageUpload.progress !== null && (
        <div
          role="progressbar"
          aria-label="Image upload progress"
          aria-valuenow={imageUpload.progress}
          aria-valuemin={0}
          aria-valuemax={100}
          className="mt-2 h-1 overflow-hidden rounded bg-[#e5e7eb]"
        >
          <div
            className="h-full origin-left bg-[#9f1239]"
            style={{ transform: `scaleX(${imageUpload.progress / 100})` }}
          />
        </div>
      )}
      {imageUpload?.notice && (
        <p role="status" className="mt-1.5 text-xs text-[#6b7280]">
          {imageUpload.notice}
        </p>
      )}
      {hint && (
        <p
          id="studio-prompt-hint"
          role="status"
          className="miad-feedback-enter mt-1.5 text-xs text-[#9a3412]"
        >
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
  studioHref,
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
  modelOptions,
  modelPreference,
  modelSelectionLoading,
  modelSelectionOperation,
  onModelPreferenceChange,
  imageUpload,
}: Pick<
  React.ComponentProps<typeof AiStudioView>,
  | 'messages'
  | 'generationProgress'
  | 'preview'
  | 'prompt'
  | 'hint'
  | 'sendDisabled'
  | 'sendLabel'
  | 'studioHref'
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
  | 'modelOptions'
  | 'modelPreference'
  | 'modelSelectionLoading'
  | 'modelSelectionOperation'
  | 'onModelPreferenceChange'
  | 'imageUpload'
>) {
  const showImageBar = preview.status === 'ready' && 'specification' in preview;
  return (
    <section
      aria-label="AI conversation"
      className="miad-studio-chat-enter flex min-h-[42rem] min-w-0 flex-col border-e border-[#d7dbe0] bg-[#f8fafc] lg:h-full lg:min-h-0"
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
        studioHref={studioHref}
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
        modelOptions={modelOptions ?? []}
        modelPreference={modelPreference ?? 'auto'}
        modelSelectionLoading={modelSelectionLoading ?? false}
        modelSelectionOperation={modelSelectionOperation ?? 'generation'}
        onModelPreferenceChange={onModelPreferenceChange ?? (() => undefined)}
        imageUpload={imageUpload}
      />
    </section>
  );
}

function CanvasPanel({
  preview,
  projectLoading,
  detailsHref,
}: {
  preview: StudioPreview;
  projectLoading: boolean;
  detailsHref: string | null;
}) {
  const readyPreview =
    preview.status === 'ready'
      ? preview
      : preview.status === 'working'
        ? preview.previous
        : undefined;
  return (
    <section
      aria-label="Live invitation preview"
      aria-busy={projectLoading || undefined}
      className="miad-studio-preview-enter flex min-h-[40rem] min-w-0 flex-col bg-[#e5e7eb] lg:h-full lg:min-h-0"
    >
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-[#cfd4da] bg-[#f3f4f6] px-3">
        <span className="material-symbols-outlined text-[18px] text-[#59616b]" aria-hidden="true">
          desktop_windows
        </span>
        <h2 className="text-xs font-semibold text-[#343a42]">Canvas</h2>
        {readyPreview && (
          <span className="min-w-0 truncate text-[11px] text-[#5f6670]">{readyPreview.title}</span>
        )}
        <div className="ms-auto flex shrink-0 items-center gap-1">
          {readyPreview && detailsHref && (
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
      <div className="relative flex min-h-0 flex-1 items-start justify-center overflow-auto p-3 sm:p-5">
        {preview.status === 'empty' && (
          <div className="flex min-h-[30rem] w-full max-w-[42rem] flex-col items-center justify-center rounded-lg border border-dashed border-[#aeb6c1] bg-[#edf0f3]/80 px-6 text-center">
            <span className="flex size-11 items-center justify-center rounded-md border border-[#fed7aa] bg-[#fff7ed] text-[#c2410c]">
              <span
                className={`material-symbols-outlined text-[23px] ${projectLoading ? 'animate-spin' : ''}`}
                aria-hidden="true"
              >
                {projectLoading ? 'progress_activity' : 'web'}
              </span>
            </span>
            <h3 className="mt-3 text-sm font-semibold text-[#343a42]">
              {projectLoading
                ? 'Opening your project…'
                : 'Your invitation preview will appear here'}
            </h3>
            <p className="mt-1 max-w-sm text-[13px] leading-5 text-[#59616b]">
              {projectLoading
                ? 'Loading your saved invitation and current design version.'
                : 'Ask Miad for an occasion, mood, and guest experience. The generated invitation stays on this canvas.'}
            </p>
          </div>
        )}
        {preview.status === 'working' && !preview.previous && (
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
              <p className="text-[13px] font-semibold text-[#343a42]">
                {preview.operation === 'refine'
                  ? 'Updating your invitation…'
                  : 'Creating your invitation…'}
              </p>
            </div>
            <div className="mt-5 animate-pulse rounded-md bg-[#e5e7eb] p-5">
              <div className="mx-auto h-3 w-24 rounded bg-[#cbd5e1]" />
              <div className="mx-auto mt-6 h-8 w-3/4 rounded bg-[#cbd5e1]" />
              <div className="mx-auto mt-3 h-3 w-1/2 rounded bg-[#d1d5db]" />
              <div className="mx-auto mt-10 h-3 w-2/3 rounded bg-[#d1d5db]" />
            </div>
          </div>
        )}
        {readyPreview && 'artifact' in readyPreview && (
          <HtmlInvitationFrame
            src={readyPreview.renderUrl}
            title={readyPreview.title}
            className="h-[68dvh] min-h-[30rem] max-h-[45rem] w-full max-w-[42rem] rounded-lg border border-[#cbd5e1] bg-white shadow-[0_12px_32px_rgba(15,23,42,0.12)]"
          />
        )}
        {readyPreview && 'specification' in readyPreview && (
          <InvitationCanvas
            specification={readyPreview.specification}
            className="min-h-[30rem] w-full max-w-[42rem] border-[#cbd5e1] shadow-[0_12px_32px_rgba(15,23,42,0.12)]"
          />
        )}
        {preview.status === 'working' && preview.previous && (
          <div
            role="status"
            aria-busy="true"
            aria-label="Updating existing preview"
            className="miad-feedback-enter absolute left-5 top-5 z-10 rounded-md border border-[#cbd5e1] bg-white/95 px-3 py-2 text-xs font-medium text-[#343a42] shadow-sm"
          >
            Updating your invitation…
          </div>
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
  studioHref,
  detailsHref,
  failedMessage,
  invitationsHref,
  imageBar,
  questionPhase = 'IDLE',
  question = null,
  questionDisabled = false,
  onQuestionAnswer,
  onQuestionCancel,
  profile,
  recentInvitations = [],
  recentProjectsLoading = false,
  projectLoading = false,
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
  publishUrl = null,
  publishing = false,
  onPublish = () => undefined,
  publicationPending = false,
  modelOptions = [],
  modelPreference = 'auto',
  modelSelectionLoading = false,
  modelSelectionOperation = 'generation',
  onModelPreferenceChange = () => undefined,
  imageUpload = null,
}: {
  messages: StudioMessage[];
  preview: StudioPreview;
  generationProgress?: AiGenerationProgress | null;
  prompt: string;
  hint: string | null;
  sendDisabled: boolean;
  sendLabel: string;
  suggestions: string[];
  studioHref: string | null;
  detailsHref: string | null;
  failedMessage: string | null;
  invitationsHref: string;
  imageBar: React.ReactNode;
  questionPhase?: StudioQuestionPhase;
  question?: SmartQuestion | null;
  questionDisabled?: boolean;
  onQuestionAnswer?: (value: string | string[] | null) => void;
  onQuestionCancel?: () => void;
  profile: StudioProfile;
  recentInvitations?: StudioRecentInvitation[];
  recentProjectsLoading?: boolean;
  projectLoading?: boolean;
  loggingOut?: boolean;
  onLogout?: () => void;
  onPromptChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  onSuggestion: (value: string) => void;
  onReloadSuggestions?: () => void;
  canReloadSuggestions?: boolean;
  publishUrl?: string | null;
  publishing?: boolean;
  onPublish?: () => void;
  publicationPending?: boolean;
  modelOptions?: AiStudioModelOption[];
  modelPreference?: string;
  modelSelectionLoading?: boolean;
  modelSelectionOperation?: AiStudioModelOption['operations'][number];
  onModelPreferenceChange?: (value: string) => void;
  imageUpload?: StudioImageUpload | null;
  micSupported?: boolean;
  listening?: boolean;
  onToggleVoice?: () => void;
}) {
  const started = messages.length > 0 || projectLoading;
  const sidebar = <StudioSidebar profile={profile} loggingOut={loggingOut} onLogout={onLogout} />;
  const composer = (
    <PromptComposer
      prompt={prompt}
      hint={hint}
      sendDisabled={sendDisabled}
      sendLabel={sendLabel}
      working={preview.status === 'working'}
      variant={started ? 'docked' : 'card'}
      onPromptChange={onPromptChange}
      onSend={onSend}
      onStop={onStop}
      micSupported={micSupported ?? false}
      listening={listening ?? false}
      onToggleVoice={onToggleVoice ?? (() => undefined)}
      modelOptions={modelOptions}
      modelPreference={modelPreference}
      modelSelectionLoading={modelSelectionLoading}
      modelSelectionOperation={modelSelectionOperation}
      onModelPreferenceChange={onModelPreferenceChange}
      imageUpload={imageUpload}
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
              recentProjectsLoading={recentProjectsLoading}
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
          <StudioHeader
            invitationsHref={invitationsHref}
            detailsHref={detailsHref}
            publishUrl={publishUrl}
            publishing={publishing}
            publicationPending={publicationPending}
            onPublish={onPublish}
          />
          {publishUrl && (
            <div
              role="status"
              className="miad-feedback-enter flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[#cfd4da] bg-white px-4 py-2 text-xs"
            >
              <span className="font-semibold text-[#047857]">
                {publicationPending ? 'New design ready to publish' : 'Published'}
              </span>
              <a
                href={publishUrl}
                target="_blank"
                rel="noreferrer"
                className="break-all text-[#374151] underline underline-offset-2"
              >
                {publishUrl}
              </a>
              <ShareButton
                url={publishUrl}
                title={preview.status === 'ready' ? preview.title : ''}
              />
              <Link
                href={publishUrl}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-[#9f1239]"
              >
                Open invitation
              </Link>
            </div>
          )}
          <div
            className={`lg:grid lg:grid-cols-[auto_minmax(0,1fr)] lg:overflow-hidden ${publishUrl ? 'lg:h-[calc(100dvh-84px)]' : 'lg:h-[calc(100dvh-48px)]'}`}
          >
            {sidebar}
            <div className="miad-studio-split-panels min-w-0 lg:min-h-0 lg:overflow-hidden">
              <AgentPanel
                messages={messages}
                generationProgress={generationProgress}
                preview={preview}
                prompt={prompt}
                hint={hint}
                sendDisabled={sendDisabled}
                sendLabel={sendLabel}
                studioHref={studioHref}
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
                modelOptions={modelOptions}
                modelPreference={modelPreference}
                modelSelectionLoading={modelSelectionLoading}
                modelSelectionOperation={modelSelectionOperation}
                onModelPreferenceChange={onModelPreferenceChange}
                imageUpload={imageUpload}
              />
              <CanvasPanel
                preview={preview}
                projectLoading={projectLoading}
                detailsHref={detailsHref}
              />
            </div>
          </div>
        </>
      )}
    </main>
  );
}
