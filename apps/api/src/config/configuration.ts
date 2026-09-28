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
  // Temporary compatibility mode: strict AI design schema checks can be
  // restored with AI_STRICT_DESIGN_VALIDATION=true.
  aiStrictDesignValidation: process.env.AI_STRICT_DESIGN_VALIDATION === 'true',
  // Phase 2 credit costs. Only AI generation and AI edits of the current
  // design consume credits; Smart Questions, manual editing, image uploads and
  // publishing are always free and never call the credit service.
  aiCreditCostGeneration: parseInt(process.env.AI_CREDIT_COST_GENERATION ?? '1', 10),
  aiCreditCostEdit: parseInt(process.env.AI_CREDIT_COST_EDIT ?? '1', 10),
  // Free plan welcome credits, granted once per normal account. Manual testing
  // only: there is no payment provider or subscription behind this yet.
  freeCreditsAmount: parseInt(process.env.FREE_CREDITS_AMOUNT ?? '10', 10),
  // Server-only Stitch credential. Never expose this in the web application.
  stitchApiKey: process.env.STITCH_API_KEY ?? '',
  // OpenRouter is the registered invitation AI provider. This must not be
  // altered by a legacy process-level AI_PROVIDER value.
  aiProvider: 'openrouter',
  // These values are deliberately server-only. Do not duplicate them in the
  // web app or expose them through a NEXT_PUBLIC variable.
  openrouterApiKey: process.env.OPENROUTER_API_KEY ?? '',
  openrouterModel: process.env.OPENROUTER_MODEL ?? 'deepseek/deepseek-v4.1-flash',
  openrouterModelGeneration: process.env.OPENROUTER_MODEL_GENERATION ?? '',
  openrouterModelGenerationFallbacks: process.env.OPENROUTER_MODEL_GENERATION_FALLBACKS ?? '',
  openrouterModelRefinement: process.env.OPENROUTER_MODEL_REFINEMENT ?? '',
  openrouterModelRefinementFallbacks: process.env.OPENROUTER_MODEL_REFINEMENT_FALLBACKS ?? '',
  openrouterModelSmartQuestions: process.env.OPENROUTER_MODEL_SMART_QUESTIONS ?? '',
  openrouterModelSmartQuestionsFallbacks:
    process.env.OPENROUTER_MODEL_SMART_QUESTIONS_FALLBACKS ?? '',
  openrouterModelImagePlanning: process.env.OPENROUTER_MODEL_IMAGE_PLANNING ?? '',
  openrouterModelImagePlanningFallbacks:
    process.env.OPENROUTER_MODEL_IMAGE_PLANNING_FALLBACKS ?? '',
  openrouterModelValidation: process.env.OPENROUTER_MODEL_VALIDATION ?? '',
  openrouterModelValidationFallbacks: process.env.OPENROUTER_MODEL_VALIDATION_FALLBACKS ?? '',
  openrouterModelFuture: process.env.OPENROUTER_MODEL_FUTURE ?? '',
  openrouterModelFutureFallbacks: process.env.OPENROUTER_MODEL_FUTURE_FALLBACKS ?? '',
  openrouterBaseUrl: process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
  openrouterRequestTimeoutMs: parseInt(process.env.OPENROUTER_REQUEST_TIMEOUT_MS ?? '120000', 10),
  // Event-detail extraction remains brief and fails safe to deterministic
  // defaults. Every model operation also has its own bounded request timeout.
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
