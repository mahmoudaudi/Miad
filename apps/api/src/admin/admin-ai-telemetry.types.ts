/**
 * AI Engine telemetry payload. The SaaS records per-run operation, outcome,
 * and tokens — but no durations, costs, model assignments, error messages,
 * or retry attempts, so none is reported.
 */

export type AdminAiKpis = {
  total: number;
  generations: number;
  refinements: number;
  successful: number;
  failed: number;
  successRate: number;
  tokensTotal: number;
  avgTokensPerRun: number;
  modelsConfigured: number;
  modelsAvailable: number;
};

export type AdminAiOperation = {
  operation: string;
  runs: number;
  share: number;
  successRate: number;
  avgTokens: number;
};

export type AdminAiDay = { day: string; successful: number; failed: number };

export type AdminAiFailure = {
  id: string;
  createdAt: string;
  slug: string;
  title: string;
  userEmail: string;
  operation: string;
  tokensUsed: number | null;
};

export type AdminAiOutput = {
  id: string;
  title: string;
  slug: string;
  operation: string;
  tokensUsed: number | null;
  createdAt: string;
};

export type AdminAiTelemetryResponse = {
  kpis: AdminAiKpis;
  operations: AdminAiOperation[];
  daily: AdminAiDay[];
  recentOutputs: AdminAiOutput[];
  failures: {
    items: AdminAiFailure[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};
