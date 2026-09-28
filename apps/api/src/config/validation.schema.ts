import * as Joi from 'joi';

export const validationSchema = Joi.object({
  PORT: Joi.number().default(3001),
  API_PREFIX: Joi.string().default('api'),
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  CORS_ORIGINS: Joi.string().default('http://localhost:3000'),
  JWT_SECRET: Joi.string().min(16).required(),
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_TTL: Joi.string()
    .pattern(/^\d+[smhd]$/)
    .default('15m'),
  JWT_REFRESH_TTL: Joi.string()
    .pattern(/^\d+[smhd]$/)
    .default('30d'),
  DATABASE_URL: Joi.string().uri().required(),
  // Server-only Supabase Storage credentials (invitation image uploads).
  // Optional so the API boots without them; image endpoints then fail with a safe 503.
  SUPABASE_URL: Joi.string().uri().allow('').default(''),
  SUPABASE_SERVICE_ROLE_KEY: Joi.string().allow('').default(''),
  AI_SERVICE_URL: Joi.string().uri().default('http://localhost:8000'),
  AI_STRICT_DESIGN_VALIDATION: Joi.boolean().default(false),
  // Phase 2 credit costs per AI generation and per AI design edit.
  AI_CREDIT_COST_GENERATION: Joi.number().integer().min(1).max(1000).default(1),
  AI_CREDIT_COST_EDIT: Joi.number().integer().min(1).max(1000).default(1),
  // Credits granted once to every normal account (Free plan welcome grant).
  FREE_CREDITS_AMOUNT: Joi.number().integer().min(0).max(100000).default(10),
  // Server-only credential for invitation HTML design generation through Stitch MCP.
  STITCH_API_KEY: Joi.string().allow('').default(''),
  // The provider implementation is bound in InvitationDesignsModule. Keep a
  // legacy AI_PROVIDER environment variable from preventing API startup.
  AI_PROVIDER: Joi.string().allow('').optional(),
  OPENROUTER_API_KEY: Joi.string().allow('').default(''),
  OPENROUTER_MODEL: Joi.string().default('deepseek/deepseek-v4.1-flash'),
  OPENROUTER_MODEL_GENERATION: Joi.string().allow('').default(''),
  OPENROUTER_MODEL_GENERATION_FALLBACKS: Joi.string().allow('').default(''),
  OPENROUTER_MODEL_REFINEMENT: Joi.string().allow('').default(''),
  OPENROUTER_MODEL_REFINEMENT_FALLBACKS: Joi.string().allow('').default(''),
  OPENROUTER_MODEL_SMART_QUESTIONS: Joi.string().allow('').default(''),
  OPENROUTER_MODEL_SMART_QUESTIONS_FALLBACKS: Joi.string().allow('').default(''),
  OPENROUTER_MODEL_IMAGE_PLANNING: Joi.string().allow('').default(''),
  OPENROUTER_MODEL_IMAGE_PLANNING_FALLBACKS: Joi.string().allow('').default(''),
  OPENROUTER_MODEL_VALIDATION: Joi.string().allow('').default(''),
  OPENROUTER_MODEL_VALIDATION_FALLBACKS: Joi.string().allow('').default(''),
  OPENROUTER_MODEL_FUTURE: Joi.string().allow('').default(''),
  OPENROUTER_MODEL_FUTURE_FALLBACKS: Joi.string().allow('').default(''),
  OPENROUTER_BASE_URL: Joi.string().uri().default('https://openrouter.ai/api/v1'),
  OPENROUTER_REQUEST_TIMEOUT_MS: Joi.number().integer().min(1000).max(180000).default(120000),
  OPENROUTER_EXTRACTION_TIMEOUT_MS: Joi.number().integer().min(1000).max(60000).default(20000),
  GEMINI_API_KEY: Joi.string().allow('').default(''),
  GEMINI_MODEL: Joi.string().default('gemini-3.8-flash'),
  GEMINI_API_VERSION: Joi.string().valid('v1').default('v1'),
  MODEL_API_KEY: Joi.string().allow('').default(''),
  META_MODEL: Joi.string().default('muse-spark-1.3'),
  AI_PROVIDER_TIMEOUT_MS: Joi.number().integer().min(1000).max(60000).default(20000),
  GOOGLE_CLIENT_ID: Joi.string().allow('').default(''),
  GOOGLE_CLIENT_SECRET: Joi.string().allow('').default(''),
  GOOGLE_REDIRECT_URI: Joi.string().uri().allow('').default(''),
  FRONTEND_URL: Joi.string().uri().default('http://localhost:3000'),
  PASSWORD_RESET_TTL_MINUTES: Joi.number().integer().min(5).max(1440).default(30),
  PASSWORD_RESET_URL: Joi.string().uri().allow('').default(''),
  PASSWORD_RESET_WEBHOOK_URL: Joi.string().uri().allow('').default(''),
});
