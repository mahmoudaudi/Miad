# apps/api — NestJS backend (foundation + auth)

## Endpoints

- `GET /api/v1/health` → `{ "status": "ok", "service": "api", "timestamp": "..." }`
- `POST /api/v1/auth/register` → creates user (role `user`), sets auth cookies
- `POST /api/v1/auth/login` → sets auth cookies (rate-limited, generic 401s)
- `POST /api/v1/auth/refresh` → rotates the token pair via refresh cookie
- `POST /api/v1/auth/logout` → clears auth cookies
- `GET /api/v1/auth/me` → current user (JWT guard, cookie or Bearer)

Auth uses short-lived access JWT (15m) + one-time rotating refresh JWT (30d)
in httpOnly cookies. Every token carries a version (`users.token_version`).
Refresh atomically consumes the presented version and issues the next one, so
the previous refresh/access pair cannot be reused. Logout bumps the version
again, instantly invalidating the current pair. RBAC uses the current database
role through `JwtAuthGuard` + `RolesGuard`. Seed roles first with
`npm run db:seed`.

For a fresh installation with no admin user, run `npm run admin:bootstrap` from
the repository root. It creates one admin account and writes its randomly
generated login details to the Git-ignored `.env.admin.local` file with
owner-only permissions. It refuses to run again once an admin exists.

## Scripts

- `npm run start:dev --workspace=@app/api` — dev server on :3001
- `npm run build --workspace=@app/api`
- `npm run test --workspace=@app/api` — unit tests
- `npm run test:e2e --workspace=@app/api` — health + full auth lifecycle E2E

## Conventions

- Global prefix `api` + URI versioning (`v1`)
- CORS allowlist via `CORS_ORIGINS`
- `ValidationPipe` (whitelist/transform), `HttpExceptionFilter` envelope
- Config via `@nestjs/config` + Joi validation

## AI website generation

AI Studio uses the NestJS API only; `apps/ai-service` is not part of this path.
Set these server-side variables in the root `.env` (never expose them to the web app):

```dotenv
OPENROUTER_API_KEY=
OPENROUTER_MODEL=deepseek/deepseek-v4.1-flash
```

Authenticated generation and refinement are available at `POST /api/v1/ai/generate`
and `POST /api/v1/ai/refine`. Generated projects contain only `index.html` and
`styles.css`, are validated and sanitized before persistence, and are rendered
in a CSP-locked, sandboxed iframe. Scripts, network access, external resources,
cookies, and parent-window access are not permitted.
