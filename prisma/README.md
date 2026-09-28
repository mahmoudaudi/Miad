# Prisma — PostgreSQL schema (ERD implemented)

Implements the approved Database Structure: **16 tables** on Supabase PostgreSQL.

## Tables

`roles`, `users`, `events`, `invitations`, `invitation_designs`, `guests`,
`rsvps`, `notifications`, `invitation_images`, `ai_usage`, `invitation_views`,
`plans`, `features`, `plan_features`, `subscriptions`, `payments`.

## Files

- `schema.prisma` — 16 models mapped to exact snake_case table/column names
  (`@@map`/`@map`), UUID PKs, JSONB design spec, uniques on
  `invitations.event_id`, `invitations.slug`, `rsvps.guest_id`,
  `(invitation_designs.invitation_id, version)`,
  `(plan_features.plan_id, feature_id)`, `payments.transaction_reference`
- `migrations/20260917123138_init/` — initial migration (applied to Supabase)

## Conventions

- Status/type fields (`rsvps.status`, `ai_usage.operation_type`, ...) stay
  `String` (@db.VarChar) exactly as specified — allowed values documented in
  comments, no extra DB-level enum constraints invented.
- `created_at` defaults to `now()`; `updated_at` uses `@updatedAt`.
- Delete behavior: Prisma defaults (restrict) — the structure specifies no
  cascades, so none were added.

## Commands (run from repo root)

- `npm run prisma:validate` — validate schema
- `npm run prisma:generate` — generate Prisma Client
- `npm run prisma:studio` — open Prisma Studio
- `npx prisma migrate dev --name <name>` — new migration after schema edits
- `npx prisma migrate status` — confirm DB is in sync

`DATABASE_URL` is read from the environment (see root `.env.example`).
Session-pooler URL (port 5432) is used so IPv4-only networks can connect.
