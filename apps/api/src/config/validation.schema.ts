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
  // Server-only Supabase Storage credentials (media uploads). Optional so the
  // API boots without them; media endpoints then fail with a safe 503.
  SUPABASE_URL: Joi.string().uri().allow('').default(''),
  SUPABASE_SERVICE_ROLE_KEY: Joi.string().allow('').default(''),
  AI_SERVICE_URL: Joi.string().uri().default('http://localhost:8000'),
  AI_PROVIDER: Joi.string().empty('').valid('openai').default('openai'),
  OPENAI_API_KEY: Joi.string().allow('').default(''),
  OPENAI_MODEL: Joi.string().default('gpt-4o-mini'),
  OPENAI_BASE_URL: Joi.string().uri().default('https://api.openai.com/v1'),
  AI_PROVIDER_TIMEOUT_MS: Joi.number().integer().min(1000).max(60000).default(20000),
  GOOGLE_CLIENT_ID: Joi.string().allow('').default(''),
  GOOGLE_CLIENT_SECRET: Joi.string().allow('').default(''),
  GOOGLE_REDIRECT_URI: Joi.string().uri().allow('').default(''),
  FRONTEND_URL: Joi.string().uri().default('http://localhost:3000'),
  PASSWORD_RESET_TTL_MINUTES: Joi.number().integer().min(5).max(1440).default(30),
  PASSWORD_RESET_URL: Joi.string().uri().allow('').default(''),
  PASSWORD_RESET_WEBHOOK_URL: Joi.string().uri().allow('').default(''),
});
