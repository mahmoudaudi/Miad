# Database (ERD implemented)

- PostgreSQL 16 — either a native local install or a Supabase (online) project (no Docker)
- Prisma schema in `/prisma/schema.prisma`: **16 models** per the approved structure
  (roles → users → events → invitations → designs/guests/rsvps/images/ai_usage/views,
  notifications, plans/features/plan_features, subscriptions → payments)
- Initial migration applied: `prisma/migrations/20260917123138_init/`
- Supabase verified: 16 tables present, `migrate status` reports in sync.
