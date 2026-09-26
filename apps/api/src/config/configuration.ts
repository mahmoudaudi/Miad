export default () => ({
  port: parseInt(process.env.PORT ?? '3001', 10),
  apiPrefix: process.env.API_PREFIX ?? 'api',
  nodeEnv: process.env.NODE_ENV ?? 'development',
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  databaseUrl: process.env.DATABASE_URL ?? '',
  supabaseUrl: process.env.SUPABASE_URL ?? '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  aiServiceUrl: process.env.AI_SERVICE_URL ?? 'http://localhost:8000',
  // OpenRouter is the registered invitation AI provider. This must not be
  // altered by a legacy process-level AI_PROVIDER value.
  aiProvider: 'openrouter',
  // These values are deliberately server-only. Do not duplicate them in the
  // web app or expose them through a NEXT_PUBLIC variable.
  openrouterApiKey: process.env.OPENROUTER_API_KEY ?? '',
  openrouterModel: process.env.OPENROUTER_MODEL ?? 'deepseek/deepseek-v4.1-flash',
  openrouterBaseUrl: process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
  // Only short event-detail extraction has a budget (it fails safe to
  // deterministic defaults). Website generation has no application-level
  // deadline: it runs until the provider responds or the caller cancels.
  // AI_PROVIDER_TIMEOUT_MS remains an extraction fallback for existing
  // deployments.
  openrouterExtractionTimeoutMs: parseInt(
    process.env.OPENROUTER_EXTRACTION_TIMEOUT_MS ?? process.env.AI_PROVIDER_TIMEOUT_MS ?? '20000',
    10
  ),
  aiProviderTimeoutMs: parseInt(process.env.AI_PROVIDER_TIMEOUT_MS ?? '20000', 10),
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI ?? '',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  passwordResetTtlMinutes: parseInt(process.env.PASSWORD_RESET_TTL_MINUTES ?? '30', 10),
  passwordResetUrl: process.env.PASSWORD_RESET_URL ?? '',
  passwordResetWebhookUrl: process.env.PASSWORD_RESET_WEBHOOK_URL ?? '',
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? '',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ?? '',
  JWT_ACCESS_TTL: process.env.JWT_ACCESS_TTL ?? '15m',
  JWT_REFRESH_TTL: process.env.JWT_REFRESH_TTL ?? '30d',
});
