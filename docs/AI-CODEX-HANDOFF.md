# Miad — AI Coding Agent Handoff

> **Status:** authoritative context for the next AI coding agent (Codex).
> Generated from a read-only audit of the repository on 2026-09-18.
> **Scope rule: feature-by-feature. Do NOT implement AI features unless explicitly requested.**

---

## 1. Project Overview

**Miad** is an AI-powered event-invitation-website SaaS: users describe an event in
natural language, the system generates a unique responsive invitation website
(not a static card), the user customizes it in a focused editor, publishes it to
a unique public URL, and manages guests/RSVP/analytics/subscriptions.

- **Repo root:** `/home/mahmoud/Desktop/event-invitation-platform`
- **GitHub:** `https://github.com/mahmoudaudi/Miad`, working branch **`develop`**
- **Current stage:** foundation (100%) + database (100%) + authentication (100%) +
  landing page UI + protected dashboard + Events CRUD + Invitation CRUD +
  Invitation Design Foundation + Invitation Editor + Public Invitation + Guests/RSVP
  (functional, verified, uncommitted).
- **Immediate priority:** Frontend + Backend + Database, feature-by-feature.
  AI is a **later phase** — do not build generation/editing unless told to.

## 2. Current Project Status

| Area                                                                | State                                                                              |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Monorepo setup (Next/Nest/FastAPI/Prisma)                           | Done, committed, pushed                                                            |
| Supabase + 16-table schema + 4 migrations                           | Done, applied, verified live                                                       |
| Roles seed (`user`, `admin`)                                        | Done (`npm run db:seed`)                                                           |
| Authentication (backend + UI + guards + tests)                      | Done, verified, **UNCOMMITTED**                                                    |
| Landing page (Minimal Editorial restyle + polish)                   | Done, verified, **UNCOMMITTED**                                                    |
| User Dashboard                                                      | Done, verified, **UNCOMMITTED**                                                    |
| Events                                                              | Done, verified, **UNCOMMITTED**                                                    |
| Invitation CRUD                                                     | Done, verified, **UNCOMMITTED**                                                    |
| Invitation Design Foundation                                        | Done, verified, **UNCOMMITTED**                                                    |
| Invitation Editor                                                   | Done, verified, **UNCOMMITTED**                                                    |
| Public Invitation                                                   | Done, verified, **UNCOMMITTED**                                                    |
| Guests + RSVP                                                       | Done, verified, **UNCOMMITTED**                                                    |
| Media, Notifications, Analytics, Subscriptions, Payments, Admin, AI | **Not started**                                                                    |
| Working tree                                                        | Large uncommitted changeset (see §19) — **do NOT commit unless the owner says so** |

## 3. Architecture

```text
apps/web (Next.js :3000, App Router)
  │  NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
  │  fetch with credentials:'include' (cookie session)
  ▼
apps/api (NestJS :3001, global prefix "api" + URI version "v1")
  │  PrismaService (Prisma Client)
  ▼
Supabase PostgreSQL (pooler :5432, 16 tables, 4 migrations applied)

apps/api ──AI_SERVICE_URL──▶ apps/ai-service (FastAPI :8000, health only)
                                    ▼ (not wired, no vendor, no model)
                              AIProvider ABC + registry
```

- Frontend never talks to the database or AI service directly.
- Backend calls the AI service server-side only (nothing implemented yet).
- Auth session = httpOnly cookies (`access_token` 15m, `refresh_token` 30d).

## 4. Repository Structure

```text
├── apps/web/                  # Next.js 14 App Router (see §5)
│   ├── app/                   # landing, login, register, dashboard routes + globals.css
│   ├── components/auth/       # AuthForms.tsx (shared LoginForm/RegisterForm)
│   ├── components/dashboard/  # client auth state + tested Dashboard view states
│   ├── components/landing/    # Header, Hero, PromptBox, TypewriterInput, PopularPrompts,
│   │                          # PreviewCards, HowItWorks, FeatureGrid, Pricing, Footer,
│   │                          # AuthModal, theme.ts, index.ts
│   ├── components/Button.tsx, Card.tsx (foundation, unused by landing)
│   ├── lib/                   # auth.ts, api-client.ts, env.ts, utils.ts, validators.ts
│   ├── middleware.ts          # route guard (see §9)
│   └── public/                # miad-logo.png (512px), fonts/metroscript-regular.otf
├── apps/api/                  # NestJS 10 (see §6)
│   ├── src/main.ts            # bootstrap: prefix, versioning, CORS, ValidationPipe, filter, cookieParser
│   ├── src/app.module.ts      # Config, Throttler, Prisma (global), Health, Auth
│   ├── src/prisma/            # PrismaModule (@Global) + PrismaService
│   ├── src/auth/              # module, controller, service, dto/*, guards/*, decorators/*
│   ├── src/health/            # module, controller, service
│   ├── src/common/            # filters/http-exception.filter.ts, interceptors/response.interceptor.ts
│   ├── src/config/            # configuration.ts, validation.schema.ts (Joi)
│   └── test/                  # app.e2e-spec, auth.e2e-spec, health.service.spec, jest-*.json, setup-e2e.ts
├── apps/ai-service/           # FastAPI (see §7)
├── packages/shared/           # types.ts, constants.ts, utils.ts (no framework deps)
├── packages/config/           # shared non-secret defaults
├── prisma/                    # schema.prisma (16 models), migrations/*, seed.ts
├── docs/                      # architecture, development, api-overview, database,
│                              # ai-service, design-system (+ this handoff)
├── .agents/skills/            # vendored Supabase agent skills (DO NOT reformat; excluded from Prettier)
├── skills-lock.json
├── package.json               # npm workspaces + orchestration scripts (see §17)
├── tsconfig.base.json         # strict TS base (strict, noUncheckedIndexedAccess)
└── .env.example               # shared template; real root `.env` is git-ignored
```

**No Docker files.** `docker-compose.yml` was deleted by owner decision; Docker is not required.

## 5. Frontend (`apps/web`)

- **Framework:** Next.js 14.2.5, React 18.3.1, TypeScript strict, `next/font` NOT used
  (fonts via `<link>` inside `<body>` — a `<link>` directly under `<html>` causes
  a React hydration error in dev; see §20.3).
- **Routes:** `/` (landing), `/login`, `/register`, `/dashboard`,
  `/dashboard/events`, `/dashboard/events/new`, `/dashboard/events/[id]`, and
  `/dashboard/events/[id]/edit`, plus event-scoped invitation list/create and
  invitation details/edit/design/editor routes, plus event-scoped guest
  list/create/details/edit routes (all dashboard routes protected),
  plus public SSR route `/invite/[slug]`.
- **`middleware.ts`:** `/dashboard/*` without `access_token` cookie → `/login`;
  authed visits to `/login`/`/register` → `/dashboard`.
- **Landing composition** (`app/page.tsx`): Header → Hero → PreviewCards →
  HowItWorks → FeatureGrid → Pricing → Footer.
- **Interactive islands (client components):** `Header` (hide-on-scroll, auth modal
  state), `PromptBox` (shared input state), `TypewriterInput` (looping placeholder,
  respects `prefers-reduced-motion`), `PopularPrompts` (deterministic first render +
  client shuffle — randomness in initial state **breaks hydration**, do not regress),
  `AuthModal` (login/register tabs, Escape/backdrop/X close, body scroll lock).
- **Auth UI:** header buttons open `AuthModal` over the landing; `/login` and
  `/register` reuse the same `AuthForms.tsx`; authenticated flows redirect to
  `/dashboard`; header and dashboard provide real logout actions.
- **Dashboard:** reuses the refresh-aware auth client and `/auth/me`; displays
  real account name/email/role and real event count/data with loading, error,
  empty, and data states. Create/View Event actions point to implemented routes.
- **API clients:** `lib/api-client.ts` (generic + refresh-aware protected client),
  `lib/auth.ts` (`register/login/logout/refreshSession/me` with
  `credentials:'include'`; `me()` returns `null` on 401), `lib/env.ts`
  (`NEXT_PUBLIC_API_URL`, default `http://localhost:3001/api/v1`),
  `lib/validators.ts` (email + min-10-char password).
- **`next.config.mjs`:** `reactStrictMode`, `poweredByHeader:false`,
  `images.remotePatterns: [{ https://lh3.googleusercontent.com }]` (demo hotlinks;
  replace with `media_assets` pipeline later).
- **Responsive:** mobile-first; header collapses (logo margin/wordmark scale down,
  nav `hidden lg:flex`, Log in `hidden sm:block`); grids `1 → sm:2 → lg:3(4)`;
  section padding `py-16 → md:py-24`. Verified by screenshot at 390/768/1024/1440.

## 6. Backend (`apps/api`)

- **Modules:** `ConfigModule` (global, Joi-validated), `ThrottlerModule`
  (100 req/min global; 10/min on register/login), `PrismaModule` (`@Global`),
  `HealthModule`, `AuthModule`.
- **Bootstrap (`src/main.ts`):** global prefix `api`, URI versioning default `v1`,
  CORS allowlist from `CORS_ORIGINS` (credentials on), global `ValidationPipe`
  (whitelist + forbidNonWhitelisted + transform), global `HttpExceptionFilter`
  (uniform `{statusCode,message,error,timestamp,path}` envelope), `cookieParser()`.
- **Auth (`src/auth/`):**
  - `auth.controller.ts` — `POST register/login/refresh/logout`, `GET me`
    (all under `/api/v1/auth`; login/register throttled; logout is
    `@UseGuards(JwtAuthGuard)` + bumps token version).
  - `auth.service.ts` — bcryptjs cost 12; email lowercased/trimmed; default role
    `user`; access JWT 15m + refresh JWT 30d; **token version (`v`) embedded in
    both tokens and enforced against `users.token_version`**; generic
    `UnauthorizedException('Invalid credentials.')` (no email enumeration);
    `409` on duplicate email; `SafeUser` never contains the hash.
  - `guards/jwt-auth.guard.ts` — access JWT from `access_token` cookie **or**
    `Authorization: Bearer`; verifies signature **and** DB liveness/version match.
  - `guards/roles.guard.ts` + `decorators/roles.decorator.ts` (`@Roles('admin')`)
    - `decorators/current-user.decorator.ts` (`@CurrentUser()`).
  - `dto/register.dto.ts` (first/last/email/password min 10, max 128),
    `dto/login.dto.ts`.
- **Health (`src/health/`):** `GET /api/v1/health` → `{status:'ok',service:'api',timestamp}`.
- **`common/interceptors/response.interceptor.ts`:** exists but **NOT registered
  globally** — responses are currently unwrapped. Wire or remove deliberately.
- **Events (`src/events/`):** guarded REST CRUD controller, ownership-scoped
  service, create/update DTO validation, canonical date/time serialization, and
  safe 404 behavior for both missing and non-owned IDs.
- **Invitations (`src/invitations/`):** guarded REST CRUD, event-derived ownership,
  validated unique slug, event-scoped listing, one invitation per event, and safe
  404 behavior for missing/non-owned resources. Creation starts in `DRAFT`; the
  guarded publication endpoint updates existing `status`/`publishedAt` fields
  and requires an active design.
- **Invitation designs (`src/invitation-designs/`):** guarded nested design API,
  event-derived ownership, three controlled presets, active version retrieval,
  validated content/color/typography/layout editor updates, and atomic version
  replacement. Its unguarded public controller returns only the normalized
  design for published slugs and exposes no internal IDs or owner data.
- **Guests (`src/guests/`):** guarded event-scoped Guest CRUD with nested ownership,
  safe 404 behavior, real RSVP state in owner responses, transactional RSVP-aware
  deletion, and a rate-limited anonymous create-only RSVP endpoint for published slugs.
- No guards besides JWT/RBAC. No custom backend middleware.

## 7. AI Service (`apps/ai-service`) — ALL PLANNED except skeleton

- **IMPLEMENTED:** FastAPI app (`app/main.py`, v0.1.0) with CORS; `GET /health`
  and `GET /api/v1/health` (+ router `/api/v1/health`); `core/config.py`
  (env-driven, no hardcoded secrets); `core/logging.py`; `models/schemas.py`
  (`HealthResponse` only); `providers/base.py` (**`AIProvider` ABC** +
  `GenerateRequest/GenerateResponse` dataclasses); `providers/registry.py`
  (register/resolve by name); `pytest.ini`; 3 passing health/abstraction tests.
- **PLANNED (do not build):** vendor selection, `/v1/generate|edit` endpoints,
  Structured Design Specification + validation, usage metering, service auth.
- `app/services/` and `app/api/deps.py` are intentional placeholders.
- Deps: `fastapi`, `uvicorn[standard]`, `pydantic v2`, `pydantic-settings`,
  `httpx`; dev: `pytest`, `pytest-asyncio`.

## 8. Database — Supabase + Prisma (authoritative detail)

- **Provider:** Supabase hosted PostgreSQL 17.6, project `yovyhkghkzgbqicmppgu`
  (region ap-southeast-2), via **Session pooler**
  `aws-0-ap-southeast-2.pooler.supabase.com:5432` (machine is IPv4-only; the
  direct `db.*.supabase.co` host is IPv6-only — pooler is mandatory here).
- **Connection string MUST include pooling flags** (Prisma engine ↔ Supavisor
  fails without them — verified):
  ```text
  postgresql://postgres.REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres?pgbouncer=true&connection_limit=1&connect_timeout=20&pool_timeout=30
  ```
- **Migrations (applied, `migrate status` = in sync):**
  `prisma/migrations/20260917123138_init` (16 tables),
  `prisma/migrations/20260918002823_add_token_version`,
  `prisma/migrations/20260920120000_add_events_user_id_index`,
  `prisma/migrations/20260921120000_add_guests_invitation_id_index`.
  Verified live: 16 app tables + `_prisma_migrations`.
- **Seed:** `prisma/seed.ts` upserts roles `user`/`admin` (`npm run db:seed`;
  requires `ts-node` on PATH → use the npm script, not bare `prisma db seed`).
- **Conventions:** PascalCase models → snake_case tables (`@@map`/`@map`);
  UUID PKs (`@default(uuid())`); `created_at @default(now())`,
  `updated_at @updatedAt` (both NOT NULL); status/type columns are **`String`
  (`@db.VarChar`) by owner decision — NO enums invented**, allowed values live in
  `///` comments; delete behavior = Prisma default (restrict, no cascades);
  PostgreSQL does not create indexes for FK columns automatically, so query-path
  indexes are explicit (`events.user_id` and `guests.invitation_id` are indexed). RLS is enabled on
  app tables without Data API policies; Nest/Prisma is the server-side data path.
  No seed data exists besides roles.
- **Models** (`prisma/schema.prisma`, 270 lines):
  - `Role` (roles): `id` UUID PK, `name` VarChar(50) unique, `description?`
    VarChar(255). → `users[]`.
  - `User` (users): `id`, `roleId` FK→roles, `firstName`/`lastName` VarChar(100),
    `email` VarChar(255) unique, `passwordHash` Text, `isActive` Boolean,
    **`tokenVersion` Int @default(0)** (bumped on logout; invalidates tokens),
    `createdAt`, `updatedAt`. → role, events, notifications, mediaAssets,
    aiUsage, subscriptions.
  - `Event` (events): `id`, `userId` FK, `title` VarChar(255), `eventType`
    VarChar(100), `description?` Text, `eventDate` `@db.Date`, `startTime?`/
    `endTime?` `@db.Time`, `venueName?` VarChar(255), `venueAddress?` Text,
    `latitude?`/`longitude?` Decimal(10,7), timestamps. → user, `invitation?` (1:1).
    Indexed on `userId` for owner-scoped list and authorization queries.
  - `Invitation` (invitations): `id`, `eventId` UUID **unique** FK (1:1),
    `slug` VarChar(255) **unique**, `status` VarChar(30), `publishedAt?`,
    timestamps. → event, designs, guests, media, aiUsage, views. The existing
    unique indexes on `eventId` and `slug` cover CRUD lookup/constraint paths; no
    Feature 4 migration was required.
  - `InvitationDesign` (invitation_designs): `id`, `invitationId` FK, `version`
    Int, `designSpecification` `@db.JsonB`, `sourceType` VarChar(30),
    `isActive` Boolean, `createdAt`. `@@unique([invitationId, version])`.
    Features 5–7 use this model unchanged; the controlled editor/public specification
    remains in the existing JSONB field, and the compound unique index covers
    invitation-scoped version lookups. No migration was required.
  - `Guest` (guests): `id`, `invitationId` FK, `name` VarChar(255), `email?`,
    `phone?` VarChar(50), timestamps. → invitation, `rsvp?` (1:1). Indexed on
    `invitationId` for owner lists and public RSVP contact matching.
  - `Rsvp` (rsvps): `id`, `guestId` UUID **unique** FK, `status` VarChar(30)
    (`ATTENDING|NOT_ATTENDING|PENDING`), `attendeesCount` Int, `message?` Text,
    `respondedAt?`, timestamps.
  - `Notification` (notifications): `id`, `userId` FK, `type` VarChar(50),
    `title` VarChar(255), `message` Text, `isRead` Boolean, `createdAt`.
  - `MediaAsset` (media_assets): `id`, `userId` FK, `invitationId` FK, `fileName`
    VarChar(255), `fileUrl` Text, `fileType` VarChar(100), `fileSize` BigInt,
    `createdAt`.
  - `AiUsage` (ai_usage): `id`, `userId` FK, `invitationId` FK, `operationType`
    VarChar(50) (`GENERATE_DESIGN|EDIT_DESIGN`), `status` VarChar(30),
    `tokensUsed?` Int, `createdAt`.
  - `InvitationView` (invitation_views): `id`, `invitationId` FK,
    `sessionIdentifier?`, `deviceType?` VarChar(30), `country?` VarChar(100),
    `viewedAt` @default(now()).
  - `Plan` (plans): `id`, `name` unique VarChar(100), `description?` Text,
    `price` Decimal(10,2), `billingInterval` VarChar(30), `isActive`, timestamps.
    → planFeatures, subscriptions.
  - `Feature` (features): `id`, `name` unique VarChar(100), `description?` Text.
    → planFeatures.
  - `PlanFeature` (plan_features): `id`, `planId` FK, `featureId` FK, `enabled`
    Boolean, `limitValue?` Int. `@@unique([planId, featureId])`.
  - `Subscription` (subscriptions): `id`, `userId` FK, `planId` FK, `status`
    VarChar(30), `startDate`, `endDate?`, `autoRenew` Boolean, timestamps.
    → user, plan, payments.
  - `Payment` (payments): `id`, `subscriptionId` FK, `amount` Decimal(10,2),
    `currency` VarChar(10), `status` VarChar(30), `transactionReference?`
    VarChar(255) **unique**, `paymentDate`, `createdAt`. (Card data must NEVER
    be stored — reference only.)
- **17 FK constraints** total (roles→users; users→events/notifications/
  media_assets/ai_usage/subscriptions; events→invitations; invitations→designs/
  guests/media/ai_usage/views; guests→rsvps; plans→plan_features/subscriptions;
  features→plan_features; subscriptions→payments).

## 9. Authentication (implemented, verified)

- **Flow:** register (role `user`, active) → httpOnly cookies set; login →
  cookies set; `GET me` (guarded); `POST refresh` (rotates pair);
  guarded `POST logout` → bumps `tokenVersion` + clears cookies.
- **Tokens:** access 15m + refresh 30d (env-overridable `JWT_ACCESS_TTL`/
  `JWT_REFRESH_TTL`); payload `{sub,email,role,v}`; secrets ≥32 chars.
- **Guards:** cookie **or** Bearer; signature + DB liveness + version match.
- **Throttling:** 100/min global, 10/min on register/login.
- **Frontend:** `/login` + `/register` pages + header `AuthModal` (tabs, Escape/
  backdrop/X close, scroll lock, reduced-motion safe); middleware guards
  `/dashboard/*`; authenticated users are routed to `/dashboard`.
- **Verified live:** 201/200/200/200/401/401/200 across the full journey;
  post-logout old tokens rejected server-side (not just cleared jars).
- **Known limitation:** no server-side session list (by design); version bump is
  the revocation mechanism.

## 10. Current UI / Design System (Minimal Editorial — `docs/design-system.md`)

- **Direction:** premium invitation brand (Apple simplicity + wedding editorial),
  never AI/developer-SaaS aesthetics.
- **Tokens** (`apps/web/tailwind.config.ts`): `background #FCFBFB`
  (barely-there maroon whisper), `surface #FFFFFF`, `ink #171717`,
  `muted #737373`, `line #E8E5DF`, `accent #8B7355` (muted gold, sparing),
  `coal #171717`, `error #ba1a1a`; primary CTA maroon **`#7A263A`**
  (buttons; matches logo).
- **Type:** display/headlines `Playfair Display` (500 weight, tight tracking);
  body/UI `Inter`; wordmark `MetroScript` (**local** `public/fonts/
metroscript-regular.otf` via `@font-face` — no CDN); icons Material Symbols.
- **Rules:** radius 12–16px; `shadow-subtle`/`shadow-lift` only; 1px `line`
  borders; **no gradients** (except a functional photo legibility scrim);
  dark `#171717` footer + featured pricing card; generous whitespace
  (`py-16 → md:py-24`); footer/wordmark use system tokens only.
- **Landing sections:** Header (logo `/miad-logo.png` 512px + `vite` wordmark,
  centered nav, Log in/Create account, hide-on-scroll-down/show-on-up) → Hero
  (`What will you celebrate?` + `PromptBox`: typewriter placeholder, shuffleable
  example pills that fill the input on click) → PreviewCards (3 static showcases)
  → HowItWorks (4 steps) → FeatureGrid (3) → Pricing (Starter $0 / Pro $29 /
  Enterprise $99, **static copy**) → dark Footer. All CTAs/links are
  visual-only placeholders (`href="#"` on nav/footer links) except auth.
- **Assets:** `public/miad-logo.png` (local ribbon-N, transparent bg);
  preview/avatars still demo hotlinks (`lh3.googleusercontent.com`) — replace
  with `media_assets` pipeline later.

## 11. Completed Features

- Monorepo + 3 runnable services + health endpoints + tooling (committed).
- Supabase + 16-table schema + 4 applied migrations + roles seed.
- Full authentication: backend module, RBAC, frontend pages + modal, middleware,
  unit + e2e + live verification (UNCOMMITTED).
- Protected User Dashboard: real account data, logout, responsive Minimal
  Editorial layout, and real event integration (UNCOMMITTED).
- Events: owner-scoped CRUD API, validated create/edit forms, list/details,
  accessible delete confirmation, Dashboard integration, tests, and responsive
  browser verification (UNCOMMITTED).
- Invitation CRUD: one draft invitation per owned event, slug create/edit,
  list/details/delete UI, event integration, ownership tests, and responsive
  browser verification (UNCOMMITTED).
- Invitation Design Foundation: persistent controlled theme specifications
  (colors, typography, layout), versioned backend writes, selector UI, owner
  isolation, and responsive browser verification (UNCOMMITTED).
- Invitation Editor: validated text/theme/color/typography/layout controls, live
  preview, local unsaved state, explicit versioned saving, persistence after
  reload, and responsive browser verification (UNCOMMITTED).
- Public Invitation: owner-only publish/unpublish using existing status fields,
  anonymous slug API, SSR `/invite/[slug]`, shared editor/public renderer, real
  metadata, safe 404 behavior, and responsive browser verification (UNCOMMITTED).
- Guests + RSVP: owner-scoped Guest CRUD, contact and RSVP status views, anonymous
  published-invitation RSVP with validation/duplicate protection, transactional
  persistence/deletion, responsive UI, and security/E2E coverage (UNCOMMITTED).
- Landing page per approved reference, Editorial restyle, full polish pass
  (badge removal, centered nav, logo iterations, typewriter, shuffle pills,
  click-to-fill, blush background, smart header, responsive pass)
  (UNCOMMITTED).
- Docs (7 files), Supabase agent skills, Jira tracking EIP4.

## 12. In Progress

- **Nothing actively in progress.** Last finished: Guests + RSVP.
  Arabic localization scope remains deferred.

## 13. Planned Features (NOT implemented — do not claim otherwise)

Registration, dashboard, Events CRUD, Invitation CRUD, the basic persistent
Invitation Design Foundation, Invitation Editor, publishing, public `/invite/[slug]`,
Guest CRUD, and public RSVP exist. Media upload, notifications, analytics,
plans/billing, payments/webhooks, and admin remain unimplemented.
AI generation/editing is an explicitly later phase.

## 14. Feature Roadmap (roadmap only)

- Authentication ✅ · User Dashboard ✅ · Events ✅ · Invitation CRUD ✅
- Invitation Design Foundation ✅ · Invitation Editor ✅ · Public Invitation ✅
- Guests & RSVP ✅ · Media · Notifications · Analytics · Subscriptions · Payments
- Admin Dashboard · AI Features · Final QA/Security/Deployment

## 15. API Endpoints (all that exist)

```text
GET  /api/v1/health            public   liveness
POST /api/v1/auth/register     public, throttled   {firstName,lastName,email,password} → SafeUser + cookies
POST /api/v1/auth/login        public, throttled   {email,password} → SafeUser + cookies
POST /api/v1/auth/refresh      refresh-cookie      rotates pair → SafeUser + cookies
POST /api/v1/auth/logout       JWT                 bumps tokenVersion + clears cookies → {status:'ok'}
GET  /api/v1/auth/me           JWT                 → SafeUser
GET  /api/v1/events            JWT + ownership     → current user's events
POST /api/v1/events            JWT + validation    → created owned event
GET  /api/v1/events/:id        JWT + ownership     → owned event or safe 404
PATCH /api/v1/events/:id       JWT + ownership     → updated owned event or safe 404
DELETE /api/v1/events/:id      JWT + ownership     → 204 or safe 404
GET  /api/v1/invitations       JWT + event ownership → owned invitations (optional eventId filter)
POST /api/v1/invitations       JWT + validation      → draft invitation for owned event
GET  /api/v1/invitations/:id   JWT + event ownership → owned invitation or safe 404
PATCH /api/v1/invitations/:id  JWT + event ownership → updated slug or safe 404
PATCH /api/v1/invitations/:id/publication JWT + validation/ownership → publish/unpublish
DELETE /api/v1/invitations/:id JWT + event ownership → 204 or safe 404
GET  /api/v1/invitations/:invitationId/design   JWT + event ownership → active design or null
POST /api/v1/invitations/:invitationId/design   JWT + validation/ownership → first active design
PATCH /api/v1/invitations/:invitationId/design  JWT + validation/ownership → new active version
GET  /api/v1/public/invitations/:slug public → published normalized design or safe 404
GET  /api/v1/events/:eventId/guests JWT + ownership → guests with RSVP state
POST /api/v1/events/:eventId/guests JWT + validation/ownership → created guest
GET  /api/v1/events/:eventId/guests/:id JWT + ownership → guest or safe 404
PATCH /api/v1/events/:eventId/guests/:id JWT + validation/ownership → updated guest
DELETE /api/v1/events/:eventId/guests/:id JWT + ownership → 204; removes linked RSVP
POST /api/v1/public/invitations/:slug/rsvp public + throttled → {status:'received'}
```

Errors use the uniform envelope; 401s are generic; 409 on duplicate email.

## 16. Environment Configuration (names only — NO secrets)

```text
DATABASE_URL (Supabase pooler + flags — see §8), PORT=3001, API_PREFIX=api,
CORS_ORIGINS, JWT_SECRET (legacy, unused by code), JWT_ACCESS_SECRET (≥32),
JWT_REFRESH_SECRET (≥32), JWT_ACCESS_TTL=15m, JWT_REFRESH_TTL=30d,
NODE_ENV, NEXT_PUBLIC_API_URL, AI_SERVICE_PORT=8000, AI_SERVICE_URL,
AI_PROVIDER/AI_API_KEY/AI_MODEL (empty), JIRA_URL/JIRA_EMAIL/JIRA_API_TOKEN (root `.env` only)
```

Local dev needs: Node ≥20 (repo runs v24; `engines` says ≥20 <23 — align in CI),
npm ≥10, Python ≥3.11 for the AI service, and a Supabase project + pooler URL.
The root `.env` is shared by API, Web, Prisma, and the AI service.

## 17. Development Commands

```bash
npm install
cp .env.example .env
npm run db:seed                    # roles (needs ts-node on PATH → use npm script)
npm run dev:api                    # NestJS :3001
npm run dev:web                    # Next.js :3000
npm run dev:ai                     # FastAPI :8000 (venv + requirements first)
npm run build / build:web / build:api
npm run lint / format / format:check
npm run test                       # workspaces (unit)
npm run test:e2e --workspace=@app/api   # --runInBand, 180s timeout (slow pooler)
npm run test --workspace=@app/web       # vitest
npm run test:ai                    # pytest
npm run prisma:validate / prisma:generate / prisma:studio
npx prisma migrate dev --name <n>  # new migrations (verify status after)
npx prisma migrate status
```

## 18. Testing

- **API unit** (`test/jest-unit.json`, e2e-spec excluded): health + auth + Events +
  Invitations + Invitation Designs + Guests/RSVP services — last: **37/37
  pass**, no DB needed.
- **API e2e** (`test/jest-e2e.json`, `--runInBand`, 180s timeout): health, full
  auth journey, Events CRUD, invalid/unauthenticated input, and cross-user
  read/update/delete denial — last: **6/6 pass** (~140s on shared-region pooler).
- **Invitation API e2e:** create/list/get/update/delete, validation,
  unauthenticated access, 1:1 conflict, event ownership, and cross-user denial —
  targeted suite last: **4/4 pass** against Supabase.
- **Invitation Design API e2e:** empty/get/create/versioned editor updates, nested
  validation, unauthenticated and cross-user denial, persistence, and deletion integration —
  targeted suite last: **4/4 pass** against Supabase.
- **Public Invitation API e2e:** draft/invalid/missing protection, validation,
  owner and cross-user protection, anonymous published access, safe response,
  and immediate unpublish protection — targeted suite last: **4/4 pass**.
- **Guests/RSVP API e2e:** authenticated CRUD, validation, safe cross-owner 404s,
  draft rejection, published anonymous RSVP, persistence, duplicate rejection,
  status semantics, and RSVP-aware deletion — targeted suite last: **5/5 pass**.
- **Web vitest:** auth, validators, middleware, foundation, dashboard, Events,
  Invitation CRUD, design foundation, editor states, publication UI, public
  rendering, Guest states/forms, RSVP validation/submission states, and public
  404 state — last: **54/54**.
- **AI pytest** (`tests/test_health.py`): 3/3 (last verified at scaffold).
- **Live:** register→me→refresh→logout→login verified; Dashboard protection,
  real account rendering, logout, and post-logout denial verified in-browser;
  Invitation Editor browser flow (Dashboard → Event → Invitation → Design →
  Editor → live edit → save → reload) and responsive layouts checked at
  390/768/1440 without horizontal overflow.
- **Public browser flow:** authenticated edit/save/publish, separate anonymous
  browser rendering with zero cookies, real metadata/design, unpublish, and
  public 404 verified at 390/768/1440 without horizontal overflow.
- **Guests/RSVP browser flow:** published invitation → anonymous RSVP → owner
  guest list reflects persisted `ATTENDING` state; public form and owner list
  verified at 390/768/1440 without horizontal overflow. Temporary data removed.
- Always run: typecheck + lint (0 warnings enforced) + relevant tests + build.

## 19. Git Status

- Branch `develop`, HEAD `c84b085`, remote `origin https://github.com/mahmoudaudi/Miad`
  (tracking, in sync). `main` does not exist locally (never pushed).
- **13 commits pushed.** Large **uncommitted** tree: all of §11-auth/UI work
  (modified: env examples, READMEs, api config/module/main/package, jest-e2e.json,
  web globals/layout/page, all landing components, tailwind; new: `src/auth/`,
  `src/prisma/`, `test/auth.e2e-spec`, `app/login|register|dashboard`, `components/auth|dashboard`,
  modal/prompt/typewriter/popular components, `lib/auth|validators`, `middleware.ts`,
  `prisma/migrations/20260918002823_add_token_version`, `schema.prisma`,
  `seed.ts`, package scripts). **No commit/push without explicit owner order.**

## 20. Known Issues

1. **Pooler latency/flakiness** (ap-southeast-2 shared): 6–21s per DB op;
   intermittent P1001 → flags (§8) + timeouts + `--runInBand` are the mitigations.
2. **Stale exported env** in long-lived shells overrides `.env` — `unset
DATABASE_URL` (or fresh shell) when switching credentials.
3. `@nestjs/jwt` must stay **v10** (v11 is ESM-only, breaks ts-jest).
4. `ResponseInterceptor` unregistered — wire or remove deliberately.
5. `JWT_SECRET` (legacy) unused by code; harmless.
6. Next.js non-fatal `patch lockfile` warning on build (exit 0); Google-Fonts
   fetch warnings when offline (runtime `<link>` unaffected).
7. `<link>` must live **inside `<body>`** in App Router layout (hydration error
   otherwise); `PopularPrompts` initial state must stay deterministic (random
   initial state breaks hydration — shuffle only post-mount).
8. Port conflicts from stale servers are routine here — `ps`+`kill` by PID;
   never `kill` unrelated user apps (e.g. purrfect-match processes).
9. `main` branch absent; `engines` (Node ≥20 <23) vs local v24 mismatch.
10. Landing nav/footer links are `href="#"` placeholders; pricing is static
    copy; demo images are external hotlinks. Dashboard and Events navigation have
    no dead links.

## 21. Important Technical Decisions

- Supabase Session pooler over local Postgres; Docker removed entirely.
- Schema mirrors owner structure exactly (snake_case via map, UUID PKs, String
  statuses with `///`-documented values, no enums, no cascades).
- Cookie session (httpOnly, Lax, Secure-in-prod) + Bearer fallback; versioned
  revocation instead of session table.
- AI stays provider-agnostic (`AIProvider` ABC + registry); generation output
  must be validated Spec JSON rendered by controlled components — never
  executable code (planned, not built).
- English-first UI; Arabic deferred. Landing tokens/components are the visual
  constitution for all screens.
- Jira EIP4 tracks phases (351–353 Done; 354 theme, 355 Arabic To Do).

## 22. Development Rules (owner-mandated)

- Feature-by-feature; one logical unit per change; **do NOT commit or push
  unless explicitly told** (`بدون commit` standing order).
- Inspect existing code before changing it; reuse architecture; keep the app
  runnable after every step.
- No invented DB models; no schema change without understanding relations
  (migrations verified with `migrate status`).
- Every feature end-to-end: validation + authorization + tests + security
  review + docs touch where behavior changed.
- **No new Jira tasks and no commit hashes in Jira** without asking.
- **Do NOT implement AI unless explicitly instructed.**

## 23. Important Warnings for Future Agents

- The uncommitted tree IS the product work — pushing a partial state or
  committing without orders violates owner rules; same for Jira edits.
- Never paste secrets/keys/passwords into chat or docs; `.env` is git-ignored
  for a reason. Credentials were exposed in chat history before — do not repeat.
- The pooler region is far and slow — distinguish slowness from breakage;
  do not "fix" working code because the free tier is laggy.
- Do not run `prisma migrate dev` casually — it applies to shared Supabase.
- Old `JWT_SECRET`/`AI_*` empties are intentional placeholders, not bugs.

## 24. Current Feature Status

The separate Invitation Media Library feature has been retired. Its gallery page,
management UI, and list/delete API are removed. Invitation photo upload and public
image delivery remain internal parts of AI Studio and generated invitations.
Existing uploaded objects and their metadata are preserved. The database migration
renames `media_assets` to `invitation_images` without deleting rows; the physical
Supabase bucket remains `invitation-media` so existing image objects remain usable.
Old `media://` design references are accepted for backward compatibility while new
specifications use `image://`.

The historical migration files and earlier handoff entries below record the schema
and implementation as they existed at that time. Their old `media_assets` names are
historical references, not active application APIs or a user-facing feature.

---

# Handoff Summary

- **Working:** monorepo application, auth, dashboard, owner-scoped Events and
  Invitations, persistent Invitation Design Foundation, Invitation Editor,
  publishing, public invitations, AI Studio image selection, Guests/RSVP,
  notifications, and invitation image storage/public delivery.
- **Retired:** standalone Invitation Media Library. Its route, gallery, management
  UI, list/delete endpoints, and feature-specific e2e suite have been removed.
- **Preserved:** uploaded image rows and Storage objects; image upload, serving, and
  invitation/event deletion cleanup required by generated invitations; compatibility
  with existing `media://` design references.
- **Do NOT change:** `.env`/secrets handling, DB provider/flags, auth architecture,
  design tokens, AI-provider abstraction, or owner rules around commits and Jira.
- **Critical warnings:** the worktree contains existing uncommitted changes; do not
  lose them or push unasked. Secrets stay out of chat/docs; hydration safeguards
  (§20.7) must not be reintroduced.

---

# 25. MASTER IMPLEMENTATION RULES

This section contains mandatory rules for all future development.

The goal is to turn the current project into a complete, production-quality SaaS application.

==================================================
25.1 FEATURE-BY-FEATURE DEVELOPMENT
==================================================

Implement the product feature-by-feature.

Do NOT implement the entire product blindly in one pass.

For every feature:

1. Inspect the existing code.
2. Inspect the existing database schema.
3. Inspect related frontend components.
4. Inspect related backend modules.
5. Understand dependencies.
6. Implement the feature completely.
7. Connect Frontend + Backend + Database.
8. Add validation.
9. Add authorization where required.
10. Add error handling.
11. Add loading and empty states.
12. Add tests.
13. Run typecheck.
14. Run lint.
15. Run relevant tests.
16. Perform a security review.
17. Verify all UI interactions.
18. Verify all API endpoints.
19. Verify database operations.
20. Fix all discovered issues.
21. Only then consider the feature complete.

Do not move to the next feature while the current feature is incomplete.

==================================================
25.2 NO DEAD UI
==================================================

CRITICAL:

There must be NO dead UI.

Every visible interactive element must have a real purpose and real implementation.

Buttons must:

- Perform a real action
- Call the correct functionality
- Show loading state when necessary
- Handle success
- Handle errors
- Update the UI appropriately

Do NOT create buttons that:

- Do nothing
- Only show an alert
- Only print to console
- Pretend to perform an action
- Say "Coming Soon"
- Are placeholders for future functionality

If a feature is not implemented yet:

DO NOT expose a fake button for it.

==================================================
25.3 NO DEAD LINKS
==================================================

Every navigation link must point to a real route.

Verify:

- Navbar links
- Sidebar links
- Footer links
- Dashboard links
- Invitation links
- Profile links
- Settings links
- Authentication links
- Public invitation links

Do NOT create links to routes that do not exist.

Do NOT use placeholder URLs such as:

#

/coming-soon
/example
/test
/placeholder

unless that route is intentionally part of the actual product.

Every route must be tested.

==================================================
25.4 NO FAKE FUNCTIONALITY
==================================================

Do NOT use fake functionality to make the UI look complete.

Avoid:

- Fake success messages
- Fake database data
- Hardcoded production statistics
- Fake authentication
- Fake API responses
- Fake RSVP submissions
- Fake payment states
- Fake subscription states
- Fake analytics
- Fake AI responses

Mock data may only be used inside tests or explicitly isolated development fixtures.

Production application flows must use the actual backend and database.

==================================================
25.5 FRONTEND + BACKEND + DATABASE
==================================================

Every data-driven feature must be implemented end-to-end.

Expected flow:

Frontend
↓
Backend API
↓
Validation
↓
Authorization
↓
Database
↓
Response
↓
Frontend state update

Do not implement frontend-only functionality for features that require persistence.

Do not create backend endpoints that are never used by the frontend.

Do not create database fields/tables that have no legitimate purpose in the product.

==================================================
25.6 DATABASE RULES
==================================================

The existing Prisma schema is the source of truth for the current database.

Before modifying the database:

1. Inspect the existing schema.
2. Understand existing relationships.
3. Determine whether the feature actually requires a schema change.
4. Avoid unnecessary tables.
5. Avoid duplicate data.
6. Preserve referential integrity.
7. Add appropriate indexes.
8. Add appropriate unique constraints.
9. Create proper migrations.

Never invent database structures without a real feature requirement.

Never delete existing data or destructive schema changes without explicit approval.

==================================================
25.7 AUTHORIZATION & OWNERSHIP
==================================================

Every protected resource must verify ownership or authorization.

Examples:

A user must not be able to:

- Access another user's events
- Modify another user's invitations
- Delete another user's guests
- View another user's private analytics
- Modify another user's subscription
- Access admin functionality without the correct role

Never trust IDs supplied by the frontend.

Authorization must be enforced on the backend.

==================================================
25.8 VALIDATION
==================================================

Validate all external input.

This includes:

- Request bodies
- Query parameters
- Route parameters
- File uploads
- Authentication inputs
- RSVP submissions
- Event data
- Invitation data
- Subscription data
- Payment/webhook data
- AI inputs

Frontend validation improves UX.

Backend validation is mandatory for security.

==================================================
25.9 ERROR HANDLING
==================================================

Every real operation must handle:

- Loading
- Success
- Validation errors
- Authentication errors
- Authorization errors
- Not found
- Server errors
- Network errors

Do not silently fail.

Do not expose sensitive internal errors to users.

Provide useful user-facing error messages.

Keep detailed technical errors in appropriate server-side logs.

==================================================
25.10 RESPONSIVE UI
==================================================

Every implemented feature must work on:

- Mobile
- Tablet
- Desktop

Use the existing design system.

Do not introduce random colors, typography, spacing, or component styles.

Maintain visual consistency with the existing Miad design language.

==================================================
25.11 DESIGN CONSISTENCY
==================================================

The product should feel like ONE product.

Use the existing design system.

Current visual direction:

Minimal Editorial.

Brand color:

#7A263A

The UI should feel:

- Elegant
- Minimal
- Premium
- Editorial
- Modern
- Invitation-focused

Avoid turning the product into a generic developer/AI dashboard.

Do not introduce:

- Neon AI aesthetics
- Excessive gradients
- Random purple AI styling
- Unnecessary glassmorphism
- Excessive cards
- Unnecessary visual complexity

==================================================
25.12 NO UNRELATED FEATURES
==================================================

Only implement features that belong to the Miad product.

Do not add:

- Random utilities
- Unrelated dashboards
- Unrelated SaaS features
- Developer tools
- Social features
- Chat systems
- Features copied from unrelated products

Every feature must have a clear relationship to the product requirements.

==================================================
25.13 ROUTE INTEGRITY
==================================================

Maintain a valid route structure.

Whenever adding a navigation link:

1. Confirm the destination route exists.
2. Confirm the route is accessible to the correct user.
3. Confirm authorization.
4. Confirm the page handles loading/error/empty states.
5. Test the route.

Whenever deleting or renaming a route:

Search the entire repository for references to it and update them.

No broken internal routes.

==================================================
25.14 API INTEGRITY
==================================================

Every API endpoint must:

- Have a clear purpose
- Validate input
- Authenticate when required
- Authorize when required
- Return consistent responses
- Handle errors
- Be tested

Do not create unused endpoints.

Do not leave partially implemented endpoints.

Do not expose sensitive information.

==================================================
25.15 TESTING REQUIREMENTS
==================================================

Every feature must include appropriate tests.

Depending on the feature:

- Unit tests
- API tests
- Integration tests
- Database tests
- E2E tests

At minimum, verify:

Happy path
Invalid input
Unauthorized access
Forbidden access
Not found
Edge cases

Do not mark a feature complete while relevant tests are failing.

==================================================
25.16 SECURITY
==================================================

Perform a security review for every feature.

Pay particular attention to:

- Authentication
- Authorization
- Ownership
- Input validation
- XSS
- SQL injection
- CSRF where applicable
- CORS
- Rate limiting
- File uploads
- Secrets
- Cookies/tokens
- Webhooks
- Payment security
- Public invitation access

Never expose:

- Password hashes
- JWT secrets
- API keys
- Database credentials
- Payment credentials
- Internal system information

==================================================
25.17 NO PREMATURE AI
==================================================

AI is an important part of Miad but must be implemented later.

Do NOT implement AI generation/editing before the core product is ready.

The AI phase should build on top of:

- Users
- Events
- Invitations
- Design Specification
- Design Versions
- Public Invitation Renderer

AI should generate structured design data, not arbitrary executable code.

Never execute AI-generated:

- JavaScript
- HTML
- CSS
- SQL
- Shell commands

Validate AI output before storing or rendering it.

==================================================
25.18 NO PREMATURE OPTIMIZATION
==================================================

Do not introduce unnecessary infrastructure.

Prefer the existing architecture unless there is a real technical reason to change it.

Do not rewrite working parts of the project simply to use a different framework/library.

==================================================
25.19 COMPLETION CRITERIA
==================================================

A feature is ONLY considered COMPLETE when:

[ ] Frontend implemented
[ ] Backend implemented
[ ] Database integration complete
[ ] Validation implemented
[ ] Authorization implemented
[ ] Loading states implemented
[ ] Error states implemented
[ ] Empty states implemented
[ ] All buttons functional
[ ] All links functional
[ ] All routes verified
[ ] API tested
[ ] Relevant tests passing
[ ] TypeScript/typecheck passing
[ ] Lint passing

[ ] Production build passing
[ ] Security review completed
[ ] No unrelated changes
[ ] No TODO placeholders for required functionality

==================================================
25.20 FINAL PRODUCT AUDIT
==================================================

After all planned features are implemented, perform a complete product audit.

Search the entire repository for:

- TODO
- FIXME
- Coming Soon
- Placeholder
- Fake data
- Mock production data
- Dead buttons
- Dead links
- Empty handlers
- console.log used as functionality
- Unused routes
- Broken routes
- Unused API endpoints
- Incomplete forms
- Unconnected database operations
- Missing validation
- Missing authorization
- Missing error handling

Verify every major user journey from beginning to end.

Example:

User
→ Register
→ Login
→ Dashboard
→ Create Event
→ Create Invitation
→ Edit Invitation
→ Publish
→ Public Invitation
→ Guest RSVP
→ Owner sees RSVP
→ Analytics
→ Subscription
→ Payment

Every implemented journey must work with real application data.

==================================================
25.21 SOURCE OF TRUTH
==================================================

When information conflicts:

1. Actual repository code
2. Prisma schema / actual database
3. Existing documented architecture
4. AI-CODEX-HANDOFF.md
5. Previous instructions

Never assume that documentation is more accurate than the actual implementation.

Always inspect the code before making architectural decisions.

==================================================
25.22 DEVELOPMENT BEHAVIOR
==================================================

Do not rush.

Do not make large uncontrolled changes.

Do not modify unrelated files.

Do not rewrite the entire project when implementing a single feature.

Keep changes focused.

After every feature:

- Review the diff
- Run tests
- Run typecheck
- Run lint
- Verify functionality
- Verify UI
- Verify API
- Verify database
- Perform security review

Only then proceed.

==================================================
25.23 PRODUCT QUALITY
==================================================

The final result should feel like a real SaaS product, not a collection of demo screens.

Users should be able to complete real workflows.

There should be no obvious:

- Broken buttons
- Broken links
- Fake data
- Placeholder pages
- Unfinished forms
- Unimplemented actions
- Random UI elements
- Unrelated functionality

The product must be coherent from:

Landing
→ Authentication
→ Dashboard
→ Event
→ Invitation
→ Editor
→ Public Invitation
→ Guests
→ RSVP
→ Analytics
→ Subscription
→ Payment
→ Admin
→ AI

==================================================
25.24 IMPORTANT
==================================================

Do not assume that visual completeness means feature completeness.

A page is not complete simply because it looks good.

A feature is not complete until the underlying:

Frontend +
Backend +
Database +
Validation +
Authorization +
Testing

are properly connected and verified.

This rule applies to the entire Miad project

---

# 26. FEATURE 10 — IN-APP NOTIFICATIONS

## Status — IMPLEMENTED — VERIFIED (2026-09-23)

### Product objective

Give an authenticated event owner a real in-app record when a guest submits a
public RSVP. The owner can review notifications in their dashboard and mark one
or all of them as read. This is an in-app notification centre only; it must use
the existing `Notification` model and create no arbitrary client-authored
notifications.

### Exact scope and user flow

1. A guest submits a valid RSVP for a published invitation through the existing
   public RSVP flow.
2. The RSVP and one `RSVP_RECEIVED` notification for the invitation's event
   owner are persisted in the same database transaction. The notification title
   and message are server-generated from the RSVP's permitted data (guest name
   and response status).
3. The owner opens **Notifications** from the dashboard navigation and sees a
   newest-first paginated list with read/unread presentation.
4. The owner can mark an individual notification as read or mark all current
   notifications as read. Local UI state updates after a successful action;
   reopening the route shows persisted state.

No arbitrary notification creation endpoint, notification detail route, count
badge, polling, or real-time delivery is part of this feature.

### Implementation steps

1. Add a focused Nest `NotificationsModule`, register it in `AppModule`, and
   reuse it from the existing RSVP transaction without changing the public RSVP
   response contract.
2. Add the protected owner-scoped list/read API and a bounded, validated cursor
   query DTO.
3. Add the dashboard Notifications route, a real navigation link, and a small
   interactive list client component.
4. Add only the index required by the list query, then test the RSVP-to-owner
   notification path end-to-end.

### Frontend plan

- **Route:** add `/dashboard/notifications`, protected by the existing dashboard
  shell. Add a real `Notifications` link to `DashboardShell` only when this
  route exists.
- **Components:** use a server route shell and a small client list island (for
  initial authenticated fetch, individual/all read actions, and local state).
  Keep presentational notification-row/list components pure where practical.
- **States:** render a lightweight loading skeleton; a genuine empty state when
  there are no notifications; a safe error state with a retry of the failed list
  request; inline action errors with a retryable read action; and an accessible
  success confirmation after marking notifications read. Disable an in-flight
  row action and the all-read action while it is saving; hide or disable the
  latter when nothing is unread.
- **Responsive behavior:** use the existing Minimal Editorial tokens and a
  single-column list that remains readable at 390px, 768px, and 1440px. Long
  notification text must wrap without horizontal overflow.
- **Data handling:** make one initial list request for the route. Retain the
  loaded page and update `isRead` locally after a successful mutation; fetch a
  subsequent page only when the owner explicitly requests more.

### Backend / API plan

- **Module:** create `apps/api/src/notifications/` with a controller, service,
  module, list-query DTO, targeted service tests, and API/e2e coverage. Register
  the module in `AppModule`.
- **Internal creation:** expose a server-only helper for the existing
  `GuestsService` to create an `RSVP_RECEIVED` notification using the active
  Prisma transaction. The public RSVP lookup must select the invitation event's
  owner ID; no client value supplies it. RSVP creation and notification creation
  must commit or roll back together.
- **Endpoints (all authenticated):**
  - `GET /api/v1/notifications?cursor=<id>&limit=<1..50>` returns only the
    current user's safe notification fields in descending `createdAt`, then
    `id`, order plus `nextCursor`.
  - `PATCH /api/v1/notifications/:id/read` marks only a notification owned by
    the current user as read and is idempotent for an already-read owned item.
  - `PATCH /api/v1/notifications/read-all` marks the current user's unread
    notifications read and returns the number changed.
- **Validation:** use `class-validator` for bounded numeric limit and UUID
  cursor/route IDs, reject malformed query values, and never accept `userId`,
  notification contents, recipient IDs, or notification type from the client.
- **Response shape:** expose only `id`, `type`, `title`, `message`, `isRead`,
  and ISO `createdAt` in list/read responses. Do not expose Prisma errors or
  internal event/invitation/guest records.

### Database plan

- Reuse `Notification(id, userId, type, title, message, isRead, createdAt)` and
  its existing relation to `User`; no table, column, enum, or relationship is
  required for this scope.
- Add one non-destructive Prisma index for the primary owner-scoped chronological
  query: `@@index([userId, createdAt, id])`. PostgreSQL does not automatically
  index the `userId` foreign-key side, and this supports bounded newest-first
  pagination (including the stable ID tie-breaker).
- Create one generated migration for that index only, after confirming the
  generated SQL and migration status. Do not add speculative unread, content,
  or notification-type indexes; no backfill is needed because read state is
  explicitly set for new rows.

### Authentication, authorization, and security

- Apply the existing JWT/auth guard to every notifications endpoint and derive
  the recipient from authenticated user context only.
- Scope list queries by `userId`. Scope individual mutation writes by both
  `id` and the authenticated `userId`; a missing or another user's notification
  returns the existing safe `404` pattern without disclosing ownership.
- Public RSVP remains public only through its existing published-invitation
  checks and validation/rate-limit protections. It may create a notification
  only for the server-resolved event owner.
- Generate title/message/type entirely on the server, validate all external
  RSVP data through the existing DTO, and render notification text as plain text
  (never injected HTML). Log technical failures server-side while returning safe
  client errors.
- This feature uses neither Storage nor new secrets. Preserve server-only
  configuration and do not add client-visible credentials.

### Performance and error handling

- No polling, WebSockets, push subscriptions, notification badge count request,
  duplicate fetches, or refetch after a read mutation. Keep the client boundary
  limited to the interactive list.
- Select only list-display fields, use a bounded cursor query and the targeted
  index, and avoid joins/N+1 queries. The RSVP path must obtain the owner ID in
  its existing invitation query rather than issuing a separate lookup.
- Keep RSVP and notification writes atomic. Preserve expected public RSVP
  validation/conflict responses; convert unexpected database errors through the
  existing safe global error handling without leaking internals. The dashboard
  surfaces network/server failures clearly and preserves already loaded items.

### Testing and verification plan

- **Backend unit tests:** cursor/limit validation; newest-first owner-scoped
  list and safe field mapping; individual read idempotency; mark-all behavior;
  missing and cross-user `404`; and server-only RSVP notification composition.
- **API/E2E tests:** unauthenticated endpoints return `401`; an owner can list
  and mark only their notifications; a second user cannot list or mutate the
  first user's rows; pagination is stable; public valid RSVP creates exactly one
  notification for the correct owner; invalid, draft, duplicate, and failed
  RSVP cases create none; transaction failure leaves neither partial RSVP nor
  notification.
- **Frontend tests:** loading, empty, error/retry, data rendering, read/unread
  presentation, individual/all read saving and success/error states, local
  updates without a second list request, and navigation to the real route.
- **Browser verification:** submit a public RSVP, sign in as its owner, review
  the notification, mark it read, reload to confirm persistence, then check
  390px/768px/1440px for no horizontal overflow. Run targeted tests, API/web
  typechecks, ESLint, Prisma validation/migration status, and production builds.

### Expected files/modules

- `prisma/schema.prisma` and one generated non-destructive migration for the
  notifications list index.
- `apps/api/src/notifications/` (module, controller, service, DTO, tests),
  `apps/api/src/app.module.ts`, and the narrowly scoped RSVP transaction change
  in `apps/api/src/guests/` plus related API tests.
- `apps/web/app/dashboard/notifications/page.tsx`, focused notification list
  components/tests, a typed notifications API helper, and the existing dashboard
  navigation component.
- `docs/AI-CODEX-HANDOFF.md` implementation status and final verification notes
  when the feature is actually implemented.

### Dependencies

No new dependency is planned. Use the existing NestJS, Prisma, class-validator,
Next.js, React, and test tooling.

### Explicitly out of scope

- Email, SMS, push, browser push, WebSocket/SSE, real-time updates, polling,
  digests, delivery retries, templates, notification preferences, quiet hours,
  notification settings, and arbitrary/manual notification composition.
- Notification links/deep-link entities, attachments, deletion/archive, search,
  filtering, analytics, billing, administration, AI, global UI/UX polish, and
  unrelated refactors.

#### Implementation status and verification notes

- **Implemented:** `apps/api/src/notifications/` (module, controller, service,
  list-query DTO + empty action-body DTO, unit tests) registered in
  `AppModule`; `GuestsModule` imports it and `GuestsService.createPublicRsvp`
  creates one `RSVP_RECEIVED` notification for the server-resolved event owner
  inside the existing Serializable RSVP transaction (owner ID taken from the
  existing invitation query — no extra lookup); title/message/type composed
  server-side from guest name + response status only. Endpoints (all JWT):
  `GET /api/v1/notifications?cursor=<uuid>&limit=<1..50>` (newest-first,
  `{createdAt desc, id asc}` keyset, owner-scoped, `nextCursor`),
  `PATCH /api/v1/notifications/:id/read` (owned-only, idempotent, safe 404),
  `PATCH /api/v1/notifications/read-all` (returns `{updated}` count).
  Frontend: `lib/notifications.ts`, `NotificationsView` (pure) +
  `NotificationsClient` (one initial fetch, local mark-read updates, no
  refetch/polling/realtime/count endpoint), route
  `/dashboard/notifications`, real Notifications link in `DashboardShell`.
- **Database:** only `@@index([userId, createdAt, id])` on `Notification`;
  migration `20260923005424_add_notification_user_created_index` (index-only
  SQL, applied; `prisma validate` OK, 6/6 migrations up to date).
- **Atomicity fix surfaced during verification:** the shared pooler adds
  ~1–2.4 s per query, so the RSVP interactive transaction exceeded Prisma's
  default 5 s timeout (P2028 → 500). The transaction now uses
  `maxWait: 10s / timeout: 20s` (semantics unchanged — still one atomic
  commit/rollback) and P2028 maps to the existing retryable 409 message.
- **Tests:** API unit **68/68** (incl. new `notifications.service.spec.ts` —
  cursor/limit validation, owner-scoped newest-first list + safe field
  mapping, mark-one idempotency, mark-all count, missing/cross-user 404,
  server-only composition; `guests.service.spec.ts` — notification created
  with server-resolved owner inside the tx, and a rollback-simulating
  transaction proves a notification failure leaves zero RSVP/guest/notification
  rows). Notifications e2e **7/7**: 401 on all endpoints, cursor/limit/UUID +
  client-field rejection (empty action DTOs → `forbidNonWhitelisted`), empty
  list, draft/invalid/duplicate RSVP create none, valid RSVP creates exactly
  one safe-field notification for the owner only, cross-user mark-one 404,
  idempotent read, stable 3-page cursor pagination, mark-all `{updated:2}`
  then idempotent `{updated:0}`, other user untouched. Web vitest **71/71**
  (incl. `NotificationsViews.test.tsx`: loading/empty/error+retry, read/unread
  presentation, saving-disabled, success, action-error+retry, pagination).
- **Quality gates:** API + web typecheck OK; both app ESLints
  `--max-warnings=0` OK (fixed one pre-existing `prefer-const` in
  `test/setup-e2e.ts`); `nest build` OK; `next build` OK with
  `/dashboard/notifications` bundled (4.28 kB page); `prisma validate` +
  `migrate status` OK.
- **Browser verification (Chrome, production `next start`, 22 checks —
  final run 22/22 after a settle-time fix on the responsive recheck):**
  register → create event/invitation → publish → **public RSVP 201** → owner
  login → **real DashboardShell Notifications link** → page shows
  server-composed `RSVP_RECEIVED` content with unread presentation → **exactly
  one initial GET /notifications** → mark-one shows success and updates
  locally **without a second list request** → reload shows persisted read
  state → mark-all disabled when nothing unread → second RSVP → mark-all
  reports `Marked 1 notification as read.` → **no horizontal overflow at
  390/768/1440** (screenshots; long text wraps) → unauthenticated route
  redirects to `/login?next=…`. Temp users/events/notifications cleaned up.
- **Environment notes:** a pre-existing `next dev` on :3000 (other terminal)
  was serving 500s after the production build replaced `.next`; it was stopped
  so verification could run, and the API watch process (`nest start --watch`
  on :3001) was left running. No remaining issues for this feature.

---

# 27. LANDING PAGE FUNCTIONAL & PERFORMANCE REFACTOR

## Status — IMPLEMENTED — VERIFIED (2026-09-23)

Scope was the landing page only (`apps/web/app/page.tsx`, `app/layout.tsx`,
`components/landing/*`, `next.config.mjs`, `tailwind.config.ts`,
`globals.css`, `public/landing/*`). No plan was written; no backend, feature,
or AI work was added.

- **Dead UI fixed:** navbar `Dashboard/Events/Templates/Analytics/Settings`
  (`href="#"`) → real `Dashboard (/dashboard)`, `Events (/dashboard/events)`,
  `Templates (/#templates)`, `How It Works (/#how-it-works)`, `Pricing
  (/#pricing)`; logo → `/`; 19 dead footer links (columns, socials,
  Privacy/Terms/Security) → 8 real links (Product: Templates, How It Works,
  Pricing, Events; Account: Log in, Create account, Dashboard,
  Notifications); 3 dead pricing CTAs → real `/register` links (the register
  page bounces signed-in visitors to the dashboard, so one target serves
  both); dead Generate Invite button → signed-in hosts go to
  `/dashboard/events/new`, everyone else to `/register` (prompt text is not
  sent anywhere — generation is a later phase); dead per-card Preview buttons
  removed along with invented `RSVP Rate` statistics; fake `Live AI Previews`
  heading → honest `Template showcase`; `href="#"` count is now 0.
- **Performance:** 11 `lh3.googleusercontent.com` images (384 KB) downloaded
  to `public/landing/` — zero third-party image requests; hero CSS background
  → `next/image fill` with sizes; all below-fold images lazy; Inter +
  Playfair Display + Pinyon Script self-hosted via `next/font` (4 Google
  stylesheets → 0; only the Material Symbols icon font keeps one stylesheet —
  `next/font` rejects it); `preconnect` for the font origins; AuthModal +
  login/register forms split out of the landing bundle with `next/dynamic
  ssr:false` (landing page JS 6.09 kB → 4.73 kB; forms load as a ~6 kB chunk
  only when the modal opens; barrel re-export removed because it defeated the
  split); scroll-hide handler rAF-throttled; above-fold logo `priority`;
  removed dead `/fonts/metroscript-regular.otf` `@font-face` (404) and added
  a real favicon. `images.remotePatterns` removed from `next.config.mjs`.
  No new dependencies; sections stay Server Components (only Header/PromptBox
  islands are client).
- **Tests:** new `components/landing/Landing.test.tsx` (6 tests: navbar data
  targets, invite routing helper, footer/pricing/templates have no `href="#"`,
  no dead buttons, no invented stats, local lazy imagery, section anchors).
  Web suite **77/77**; web typecheck OK; web ESLint `--max-warnings=0` OK;
  `next build` OK (`/` = 4.73 kB page / 107 kB first load).
- **Browser verification (Chrome, production `next start`, 33/35 literal):**
  all nav/footer/CTA/auth-links/Create-Invitation flows navigate to real
  destinations; suggestion pills fill the prompt; modal opens, lazy-loads
  (+1 JS chunk), switches mode, closes on Escape; 11/11 images load with zero
  third-party image requests; register → greeting → Generate Invite →
  `/dashboard/events/new`; **no horizontal overflow at 390/768/1440**
  (screenshots); zero JS page errors. The 2 non-passing checks are explained,
  not regressions: (1) the fonts assertion was written too strictly — exactly
  one Google CSS request remains (symbols only, proven: zero Inter/Playfair/
  Pinyon CSS); (2) the anonymous session probe (`/auth/me` → 401) logs
  DevTools resource entries — pre-existing architecture shared by the
  dashboard/login/register pages, functionally correct, and changing it would
  require altering the completed auth feature. Temp user cleaned up.
- **Environment notes:** the pre-existing `next dev` (:3000) and the API
  watch process (:3001) were restarted after verification; both return 200/ok.

---

# 28. LANDING CACHING FOLLOW-UP (2026-09-23)

The landing page felt slow, so behavior was measured first on production
(`next start`), then only proven-beneficial caching was added. Landing scope
only; auth backend untouched; no new features.

- **Measured baseline (cold, anonymous):** DCL 249 ms, load 1066 ms, LCP
  684 ms (H1 text); 27 requests / 392 KB; slowest single resource was the
  render-blocking Material Symbols stylesheet (195 ms, third-party);
  anonymous `/auth/me` probe 7 ms (fast 401, no DB); repeat visit already
  near-free (DCL 24 ms, load 49 ms, 300 B total via heuristic cache).
  Authenticated header resolution took ~6–7 s — API/pooler DB-lookup latency,
  not landing render (LCP stays ~680 ms; the page never blocks on auth).
- **What was cached:** `public/landing/*` and `public/fonts/*` →
  `public, max-age=31536000, immutable` (were `max-age=0`; content-stable
  filenames, zero staleness risk); `images.minimumCacheTTL` 60 s → 1 y
  (optimized sources are immutable local files); the Material Symbols woff2
  (324 KB) was downloaded to `public/fonts/` with an identical-recipe
  `@font-face` — the last render-blocking third-party request is gone
  (4 Google stylesheets → 0 across both landing tasks) and the icon-ligature
  flash is fixed. `sharp` added to `apps/web` (was missing in production —
  the officially required optimizer; also fixes event-loop blocking on
  first-hit optimization). `/_next/static/*` already immutable (verified).
- **After (cold, anonymous):** DCL 249 → 122 ms, load 1066 → 278 ms, LCP
  steady at ~676 ms (H1); repeat visit unchanged at ~300 B / ~50 ms.
- **Intentionally NOT cached:** `/auth/me` (private; CDP-proven
  `fromCache:false` on every visit — always network, so stale auth state is
  impossible; no backend change needed); `/` HTML (repeat visits already
  ~300 B; explicit `max-age` would risk stale deploys for zero measured
  gain); no auth-state tricks (no optimistic anonymous flash — would be stale
  behavior for signed-in users); no backend changes at all.
- **Corrections found while measuring:** `public/fonts/metroscript-regular.otf`
  exists (an earlier note wrongly called it a dead 404) — its `@font-face`
  was restored; `/_next/image` 400s at widths like 380/512 are correct
  behavior (not in `imageSizes`/`deviceSizes`; browsers only request srcset
  widths — 11/11 images load).
- **Verified:** anonymous + authenticated visits, hard refresh, repeat visit,
  full logout → ANON → hard refresh → ANON → re-login → AUTHED cycle (no
  stale state), 34/35 functional checks (only delta: the benign anonymous
  401 probe, which is DevTools-only and architecturally required), no
  overflow at 390/768/1440, zero JS page errors. Temp users cleaned.
  Web typecheck/ESLint/tests (77/77)/`next build` all green.
- **Remaining bottlenecks (outside landing scope):** authed `/auth/me`
  ~6 s (pooler latency — API-side); dev-mode (`next dev`) will always feel
  slow (unminified, on-demand compile); HTTP/1.1 without a CDN locally.

---

# 29. LANDING PAGE REDESIGN — AI SAAS (UI/UX PRO MAX SKILL)

## Status — IMPLEMENTED — VERIFIED

Redesigned ONLY the public landing page (`apps/web/app/page.tsx`,
`app/layout.tsx` untouched except nothing — fonts/config from §27-§28 kept,
`components/landing/*`) using the UI/UX Pro Max skill (Soft UI Evolution,
AI-Driven Dynamic Landing pattern, subtle motion, spacious density; brand
tokens and self-hosted fonts kept — no Replit copying). No backend, database,
auth, feature, AI, or dependency changes.

- **Sections:** navbar (How It Works / Templates / Pricing + Log in →
  `/login`, Create Invitation → `/register`, authed Dashboard link +
  greeting + logout, functional mobile menu with Escape/arialog) → AI hero
  ("Turn your idea into an invitation website." + honest composer entry) →
  invitation preview (browser frame rendering the REAL `InvitationCanvas`
  with labeled Sarah & Ahmad example content — same engine as real
  invitations, zero interactive fakes) → 3-step editorial How It Works →
  template showcase (the 3 REAL editor themes rendered by the real canvas,
  links → `/register`, positioned as inspiration) → transformation trio
  (prompt → AI → website, static explanation) → 6 REAL capabilities only
  (editor, online RSVP, guests, photo library, shareable links, in-app
  notifications) → honest trust strip (no counts/testimonials/stats) →
  pricing preview (CTAs → `/register`) → final CTA (`/register`) → footer
  with real links only (Product + Account).
- **Honesty enforced:** `href="#"` count is 0; dead Preview/AuthModal/buttons
  removed (`AuthModal.tsx`, `PreviewCards.tsx` deleted); fake RSVP rates and
  "Live AI" claims removed; template images/avatars left on disk
  unreferenced; prompt text is never sent anywhere (CTA routes to signup —
  no fake AI processing).
- **Performance:** server components throughout except Header/composer/Reveal
  islands; `AuthModal` deletion removed the lazy auth chunk entirely;
  landing page JS 4.73 → **4.44 kB**; cold prod DCL **121 ms**, load
  **236 ms**, LCP **684 ms** (H1 text), 18 requests (was 27 — canvases
  replaced remote imagery); fonts unchanged (self-hosted); Reveal is a 35-line
  IO wrapper with CSS-module transitions + reduced-motion support + noscript
  fallback; typewriter/shuffle behavior preserved.
- **Tests/gates:** rewrote `Landing.test.tsx` (11 tests: nav data, invite
  routing, real footer/pricing/template links, real canvas content, honesty
  assertions); web suite **84/84**; typecheck OK; ESLint `--max-warnings=0`
  OK; `next build` OK (`/` static).
- **Browser verification (Chrome, production, 40/40):** hero message,
  composer fill + anonymous → `/register` + signed-in → `/dashboard/events/
  new`, all nav/footer/pricing/template/final-CTAs navigate, mobile menu
  opens/navigates/closes, auth register → greeting → logout path, 11-theme
  canvases render, no overflow at **390/768/1024/1440** (screenshots), zero
  JS page errors, zero console errors (except the known benign anonymous 401
  probe). Temp users cleaned; dev server restarted.
