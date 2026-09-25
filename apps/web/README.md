# apps/web — Next.js frontend

Implemented scope: the public landing page, authentication UI, and protected
user dashboard. Other product features are intentionally not implemented yet.

## Scripts

- `npm run dev --workspace=@app/web` — start dev server on :3000
- `npm run build --workspace=@app/web` — production build
- `npm run lint --workspace=@app/web` — ESLint
- `npm run typecheck --workspace=@app/web` — `tsc --noEmit`
- `npm run test --workspace=@app/web` — Vitest foundation test

## Structure

- `app/` — landing, login, registration, and protected dashboard routes
- `components/auth/` — shared login and registration forms
- `components/dashboard/` — authenticated dashboard state and Minimal Editorial UI
- `components/landing/` — landing sections, auth modal, authenticated header/logout state
- `lib/auth.ts` — cookie-auth client with one-time refresh recovery
- `middleware.ts` — protected-route and auth-route redirect behavior

The dashboard reuses `/api/v1/auth/me` for real account information. It does
not expose event controls, statistics, or links for features that do not exist.
