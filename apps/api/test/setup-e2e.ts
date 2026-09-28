/**
 * E2E setup — runs before test files are imported.
 * Provides the required env so Joi config validation passes at module load.
 * Test-only dummy values; never real secrets.
 *
 * Also loads the root (git-ignored) `.env` without overriding the real
 * process environment, so optional Feature 9 storage credentials
 * (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY) are visible to specs.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadLocalEnv(): void {
  try {
    const raw = readFileSync(resolve(__dirname, '../../.env'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
      if (!match) continue;
      const key = match[1] as string;
      const value = (match[2] ?? '').replace(/^["']|["']$/g, '');
      if (value.length > 0 && process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch {
    // No root .env — optional storage tests will skip.
  }
}

loadLocalEnv();

process.env.JWT_SECRET ??= 'test-secret-min-16-chars-ok';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-at-least-32-chars';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-at-least-32-chars';
process.env.PORT ??= '3001';
process.env.CORS_ORIGINS ??= 'http://localhost:3000';
process.env.AI_SERVICE_URL ??= 'http://localhost:8000';
