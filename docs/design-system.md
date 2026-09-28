# Miad — Minimal Editorial Design System

**Status:** adopted as the single visual language for the whole project
(Landing → Login → Dashboard → Editor → Public invitations).

**Idea:** simple, elegant, warm — a premium invitation brand, not a SaaS/developer tool.
Feeling target: Apple simplicity + modern wedding/editorial design + AI product.
The user should feel they entered a platform that crafts an elegant invitation,
not an "AI tool".

## Colors

| Token          | Value     | Usage                                         |
| -------------- | --------- | --------------------------------------------- |
| Background     | `#FCFBFB` | Page background (barely-there maroon whisper) |
| Surface        | `#FFFFFF` | Cards, panels                                 |
| Primary text   | `#171717` | Headings, body                                |
| Secondary text | `#737373` | Subtitles, muted copy                         |
| Border         | `#E8E5DF` | Thin borders, dividers                        |
| Accent         | `#8B7355` | Muted warm gold/brown, sparingly              |
| Dark section   | `#171717` | Alternating dark bands + footer               |

## Typography

- **Headings:** elegant serif — `Playfair Display` (recommended; more weights).
- **Body/UI:** clean sans-serif — `Inter` (already in use).
- Large headings, generous line-height, lots of whitespace.
- Avoid overly bold/heavy typography (headings 500–600, never black weights).

## UI Style

- Radius **12–16px**, never pill-excessive (except tiny badges).
- Very subtle shadows (`0 1px 2px rgba(23,23,23,0.04)` scale).
- Thin 1px borders in `#E8E5DF`.
- Minimal cards, minimal iconography (line icons only, no emoji).
- **No gradients. No neon. No developer-dashboard aesthetic.**

## Buttons

- **Primary:** dark `#171717` button, white text, radius ~12px.
  Label pattern: `Create your invitation →`
- **Secondary:** transparent/white with thin `#E8E5DF` border, dark text.
  Label pattern: `Explore examples`

## Layout

- Lots of whitespace; editorial rhythm (large type + image/text compositions).
- Asymmetric sections over uniform card grids.
- Big invitation previews instead of `[Card] [Card] [Card]`.
- Subtle motion only (fade/rise on scroll, no bouncy physics).

## Rules for every new screen

1. Use only the palette above (+ tints via opacity, never new hues).
2. Serif for display headings, Inter for everything else.
3. Dark `#171717` reserved for primary buttons and occasional dark sections.
4. Accent `#8B7355` sparingly (eyebrows, dividers, small highlights).
5. No gradients, no neon, no heavy shadows, no pill buttons (except badges).
6. Mobile-first responsive; generous section padding (`py-24`+ scale).

## Migration note

- The landing page (`apps/web`) already follows this system: Editorial tokens in
  `tailwind.config.ts`, Playfair Display + Inter, dark primary buttons, no
  gradients, dark footer. Same structure and copy as the approved reference.

## September 2026 frontend modernization

The implementation now extends the editorial system above with the existing
Miad burgundy as the primary action color. These rules supersede the earlier
black-only button and seven-color palette guidance.

### Semantic palette

| Token | Value | Purpose |
| --- | --- | --- |
| `background` | `#FCFAF8` | Warm workspace canvas |
| `surface`, `elevated` | `#FFFFFF` | Forms, panels, disclosures |
| `foreground`, `ink` | `#171717` | Primary copy |
| `muted` | `#686461` | Readable supporting text |
| `border`, `line` | `#E4DED8` | Quiet separation |
| `primary` | `#7A263A` | Creation, publishing, focus |
| `primary-hover` | `#682032` | Hover feedback |
| `primary-foreground` | `#FFFFFF` | Text on primary controls |
| `secondary` | `#F4EAE5` | Active navigation and badges |
| `surface-muted` | `#F6F3EF` | Recessed content |
| `accent` | `#80694D` | Editorial eyebrows |
| `ai` | `#704D79` | Reserved AI accent |
| `success` | `#2F6B45` | Confirmed outcomes |
| `warning` | `#875000` | Unsaved/pending information |
| `destructive`, `error` | `#BA1A1A` | Destructive actions and failures |

Brand CSS variables live in `apps/web/app/globals.css`; Tailwind aliases support
opacity modifiers. Invitation canvas palettes remain user-controlled and do not
inherit workspace colors.

### Type and layout

Keep Playfair Display for editorial headings, Inter/system sans for controls and
body text, and the supplied local MetroScript for decorative wordmarks. UI type:
11–13px labels, 14px body, 16px supporting copy, 20–28px section headings,
28px mobile page headings and 40px desktop page headings. Use existing Tailwind
four-point spacing (4, 8, 12, 16, 24, 32, 40, 48) and fluid wrapping.

Standard page gutters: 16px mobile, 24px tablet, 32px desktop. Typical content is
900–1200px wide; forms are narrower and the editor allows 1400px. Keep a single
primary action per group. Use thin borders; reserve lift shadows for overlays.
Use status color with text, never as the only signal.

The existing breakpoints remain: sm 640, md 768, lg 1024, xl 1280, 2xl 1536.
Workspace navigation becomes a drawer below lg; the editor has separate Edit and
Preview panels below xl, native collapsible control groups, and a fixed save bar
with matching content padding and safe-area spacing.

### Shared controls and accessibility

- `Button`: primary, secondary, ghost and destructive variants; native disabled
  and busy semantics, 44px minimum height, visible focus, slight press feedback.
- `miad-input`: inputs, selects and textareas share borders, spacing, focus,
  validation and disabled states. Mobile text inputs remain at least 16px.
- `Card`: a section with an h2, consistent spacing and a quiet border.
- `Popover` and `AccountMenu`: ordinary links/buttons, Tab and arrow navigation,
  outside dismissal, Escape and trigger focus restoration.
- `useOverlay`: dialogs/drawers contain focus, lock body scrolling, handle Escape
  and restore the invoking control. Nested popovers dismiss independently.
- `miad-badge`: compact, textual statuses. Notifications count only loaded unread
  items and explicitly identify that scope.
- `ErrorState`: recoverable route errors without exposing technical details.
- Existing native checkbox, radio and range controls retain keyboard behavior,
  with brand accent and visible focus. Existing inline alerts/statuses retain
  their live-region semantics; loading skeletons retain contextual labels.

### Motion

Use 160ms interaction feedback and 240ms state transitions with
`cubic-bezier(.2,.8,.2,1)`. Prefer transform and opacity. No animation dependency.

| Component | Product integration | Behavior |
| --- | --- | --- |
| `ShareButton` | Published invitation details | Disclosure, staggered options, awaited clipboard feedback, optional browser share, manual-copy fallback |
| `DeleteButton` | Shared deletion confirmation for invitations, events, and guests | Physical trash/text movement, loading/error states, repeated-click protection |
| `PublishButton` | Invitation publication/unpublication | Stable width, rolling text, pending/success/error labels; success settles to the next available action |
| `SendButton` | AI studio generation and public RSVP | Dark pill, restrained hover glow, moving icon, request states |
| `LookAwayLogin` | Login and registration, standalone and modal | Four CSS characters; mouse tracking; look away for password focus; receives no password values |
| Existing `Reveal` / `TypewriterInput` | Landing | Progressive enhancement; pause placeholder typing during input; respect preference changes |

All CSS animation and transitions stop under `prefers-reduced-motion`. Eye
tracking and placeholder animation also honor the preference in JavaScript.
Search, OTP, theme switching, billing, and account settings were not added:
there are no existing product flows for those features.
