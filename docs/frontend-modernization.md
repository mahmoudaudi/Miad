# Miad frontend modernization — implementation and verification

## Audit before implementation

Inspected the web route tree, all frontend feature areas, view/client boundaries,
shared primitives, global CSS, Tailwind configuration, dependencies, existing
unit tests, and relevant data-client contracts. The repository is a monorepo:
Next.js 14 App Router/React 18/TypeScript/Tailwind 3 frontend, separate API and AI
services, and shared packages. No animation or headless component library was
installed. Existing responsive defaults are Tailwind's standard breakpoints.

The existing landing work established a useful cream/ink/serif identity. The
workspace already used burgundy, but repeated hex colors and control classes
were not captured consistently in tokens. Button and Card still used a different
slate foundation. Dialog focus behavior was duplicated; auth modals lacked
containment/restoration; account disclosures lacked outside dismissal. Closed
mobile navigation could remain keyboard reachable. The dashboard spent most of
the first screen on whitespace and showed an unsupported settings/credits link
and an inferred AI count. Editor controls formed one long mobile column before
the preview. Some RSVP radios had no visible keyboard focus. Clipboard success
was shown without waiting for copying to succeed. The icon font relied on a
remote stylesheet despite an existing local font asset.

Existing creation clients already preserve persisted invitations when generation
fails and expose a retry. Those contracts and retry paths are retained. There
are no search, OTP, theme-switching or account-settings routes. The existing
Google auth button reports unavailability; no Google auth integration was added.
The supplied attachment describes reference motion but does not include a
separate visual reference asset.

## Implementation

Preserved all routes and the client/view split. No API, database, authentication,
authorization, Supabase, infrastructure or backend changes were made. Existing
uncommitted work was preserved. No commits, pushes or destructive Git operations.

The system keeps Miad's established branding and adds semantic tokens, common
control styles, consistent page rhythm, an accessible account menu and mobile
navigation, branded auth forms, responsive editor panels and control groups,
compact guest response summaries, semantic notification timestamps, and accurate
sharing feedback. Existing error, empty and loading states remain available.
New route error boundaries provide retry controls for otherwise uncaught errors.

The AI studio now passes the persisted invitation’s editor URL on generation failure, so the existing retry/manual-editor notice can actually render.

The editor also retains edits made while a save request is in flight, suspends
autosave after errors until an edit or explicit retry, and prevents overlapping
save/AI operations. This is a frontend state fix; API requests are unchanged.

See [design-system.md](design-system.md) for tokens and the motion integration map.

## File inventory

New reusable components:

- `apps/web/components/ui/AccountMenu.tsx`
- `apps/web/components/ui/ActionButtons.tsx` (PublishButton, DeleteButton, SendButton)
- `apps/web/components/ui/ErrorState.tsx`
- `apps/web/components/ui/Popover.tsx`
- `apps/web/components/ui/ShareButton.tsx`
- `apps/web/components/ui/useOverlay.ts`
- `apps/web/components/auth/LookAwayLogin.tsx`

New route boundaries:

- `apps/web/app/dashboard/error.tsx`
- `apps/web/app/invite/[slug]/error.tsx`

Modified foundations: `apps/web/app/globals.css`, `app/layout.tsx`, `app/page.tsx`,
`tailwind.config.ts`, `components/Button.tsx`, and `components/Card.tsx`.

Modified feature files include:

- Auth: `app/login/page.tsx`, `app/register/page.tsx`, `components/auth/AuthForms.tsx`.
- Navigation/workspace: `DashboardShell.tsx`, `DashboardView.tsx`, `DeleteConfirmationDialog.tsx`.
- Landing: `Header.tsx`, `AuthModal.tsx`, `Hero.tsx`, `Reveal.tsx`, `Reveal.module.css`,
  `TypewriterInput.tsx`, `theme.ts`, and existing section/control token references.
- Invitations: `InvitationDetailsView.tsx`, `InvitationDetailsClient.tsx`,
  `InvitationEditorView.tsx`, `InvitationEditorClient.tsx`, `AiStudioView.tsx`,
  `PublicRsvpForm.tsx`, `InvitationForm.tsx`, `CreateInvitationClient.tsx`,
  `StudioImageBar.tsx`, and token/spacing references in the existing design/list views.
- Events: form/list/detail/create/edit presentation and token references.
- Guests: `GuestForm.tsx`, `GuestsListView.tsx`, and detail/create/edit token references.
- Media: `MediaLibraryView.tsx`; notifications: `NotificationsView.tsx`.
- Browser regression checks: `apps/web/qa/responsive.cjs` and `apps/web/qa/interactions.cjs`.
- Tests: landing and notification assertions now cover the account disclosure and
  actual unread count rather than obsolete markup/color literals.
- `package-lock.json`: added only eight missing optional platform entries for the
  already-declared Next SWC compiler version. No existing lock entry or application
  dependency version changed; this fixes Next's broken automatic lockfile patch.

## Verification scope

Browser tests use isolated intercepted fixture responses; they do not submit
requests to production APIs. Actual live account, AI-provider, publishing and
storage integration checks still require the application's normal environment.
No authenticated production data was accessed or modified during QA.
