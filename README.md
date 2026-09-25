# AI-Powered Event Invitation Website Platform

SaaS platform where users generate complete responsive event invitation websites with AI.

> **Setup phase only.** This repository currently contains the technical foundation.
> No product features are implemented yet (no auth, invitations, AI generation,
> editor, RSVP, guests, notifications, analytics, subscriptions, payments, or admin).

## Architecture

```
apps/web (Next.js) ──► apps/api (NestJS, /api/v1) ──► PostgreSQL (Prisma)
                             │
                             └──► apps/ai-service (FastAPI)
packages/shared · packages/config · prisma/ · docs/
```

See `docs/architecture.md`.

## Tech stack

| Layer      | Tech                                                                                                  |
| ---------- | ----------------------------------------------------------------------------------------------------- |
| Frontend   | Next.js 14 (App Router), TypeScript (strict), Tailwind CSS 3, ESLint, Prettier, Vitest                |
| Backend    | Node.js 20+, NestJS 10, TypeScript (strict), class-validator, Joi config validation, Jest + Supertest |
| Database   | PostgreSQL 16 (native install), Prisma ORM + CLI                                                      |
| AI service | Python 3.12, FastAPI, Pydantic v2, pytest (replaceable `AIProvider` abstraction)                      |
| Tooling    | npm workspaces, Prettier                                                                              |

## Project structure

```
/
├── apps/web/          # Next.js frontend foundation
├── apps/api/          # NestJS backend (GET /api/v1/health)
├── apps/ai-service/   # FastAPI AI service (GET /health, provider abstraction)
├── packages/shared/   # Shared types/utils
├── packages/config/   # Shared non-secret defaults
├── prisma/            # Prisma generator + datasource (NO models yet — ERD pending)
├── docs/              # architecture, development, api, database, ai-service
├── .env.example
└── package.json       # workspaces + orchestration scripts
```

## Prerequisites

- Node.js >= 20, npm >= 10
- Python >= 3.11 (3.12 recommended) + `venv`
- PostgreSQL 16 (native local install) **or** a Supabase project (online, no Docker)
- Git

## Installation

```bash
git clone <repo-url>
cd event-invitation-platform
git checkout develop
cp .env.example .env
npm install
```

## Environment variables

Copy `.env.example` → `.env`. Per-app templates: `apps/web/.env.example`,
`apps/api/.env.example`, `apps/ai-service/.env.example`.

| Variable                                   | Used by      | Notes                                                                               |
| ------------------------------------------ | ------------ | ----------------------------------------------------------------------------------- |
| `DATABASE_URL`                             | api, prisma  | e.g. `postgresql://postgres:postgres@localhost:5432/event_invitation?schema=public` |
| `JWT_SECRET`                               | api          | min 16 chars, never commit real value                                               |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | api          | min 32 chars each (`openssl rand -hex 32`), never commit                            |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL`       | api          | defaults `15m` / `30d`                                                              |
| `PORT`                                     | api          | default `3001`                                                                      |
| `CORS_ORIGINS`                             | api          | comma-separated, default `http://localhost:3000`                                    |
| `NEXT_PUBLIC_API_URL`                      | web          | e.g. `http://localhost:3001/api/v1` (only `NEXT_PUBLIC_*` reaches the browser)      |
| `AI_SERVICE_URL`                           | api (server) | default `http://localhost:8000`                                                     |
| `AI_PROVIDER` / `AI_API_KEY` / `AI_MODEL`  | ai-service   | empty until provider chosen; never commit keys                                      |

`.env` is git-ignored. Never hard-code secrets.

## Database setup (PostgreSQL — local or Supabase, no Docker)

Pick one option:

**Option A — Supabase (online, recommended if you don't want a local install):**

1. Create a free project at https://supabase.com
2. Go to Project Settings → Database → Connection string → URI (use the
   **Direct connection**, port `5432`).
3. URL-encode special characters in the password (e.g. `@` → `%40`) and put it
   in your `.env` as `DATABASE_URL`.

**Option B — native PostgreSQL 16:**

1. Install PostgreSQL 16 natively and start the server.
2. Create the database (adjust user/password to match your `DATABASE_URL`):

```bash
createdb event_invitation
pg_isready -h localhost -p 5432   # expect: accepting connections
```

Then, from the repo root (both options):

```bash
npm run prisma:validate        # validate prisma/schema.prisma
npm run prisma:generate        # generate Prisma Client
```

Prisma schema intentionally has **no models** — the final ERD arrives in the next phase.

## Frontend startup (Next.js :3000)

```bash
npm run dev:web
# or: npm run dev --workspace=@app/web
```

Open http://localhost:3000 — a foundation verification card (not a product screen).

## Backend startup (NestJS :3001)

```bash
npm run dev:api
# or: npm run start:dev --workspace=@app/api
```

Verify: http://localhost:3001/api/v1/health → `{ "status": "ok", ... }`

## AI service startup (FastAPI :8000)

```bash
python -m venv .venv && source .venv/bin/activate   # windows: .venv\Scripts\activate
pip install -r apps/ai-service/requirements.txt -r apps/ai-service/requirements-dev.txt
npm run dev:ai
# direct: uvicorn app.main:app --reload --port 8000 --app-dir apps/ai-service
```

Verify: http://localhost:8000/health and http://localhost:8000/api/v1/health

## Testing

| Scope               | Command                                  |
| ------------------- | ---------------------------------------- |
| all (workspaces)    | `npm test`                               |
| web (Vitest)        | `npm run test --workspace=@app/web`      |
| api unit (Jest)     | `npm run test --workspace=@app/api`      |
| api e2e (Supertest) | `npm run test:e2e --workspace=@app/api`  |
| ai-service (pytest) | `npm run test:ai`                        |
| format check        | `npm run format:check`                   |
| web typecheck       | `npm run typecheck --workspace=@app/web` |
| api typecheck       | `npm run typecheck --workspace=@app/api` |

Setup-phase tests are health/foundation checks only.

## Development workflow

See `docs/development.md`. Branch: `develop` (do not commit directly to `main`).
Conventional commits, e.g. `chore: setup nestjs backend`.

## Status

Foundation complete. Next phase needs: final ERD → Prisma models/migrations;
final UI design → real screens; feature plan → auth/invitations/AI/RSVP/etc.
