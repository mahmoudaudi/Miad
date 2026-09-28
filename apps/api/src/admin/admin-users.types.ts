/** Users directory payload. "Free" means no active subscription; there is no quota system. */

export type AdminUserItem = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  invitationsCount: number;
  aiRuns: number;
  plan: string;
};

export type AdminUsersKpis = {
  total: number;
  newThisWeek: number;
  growthRate: number;
  /** Users with an event or AI run in the last 30 days (the SaaS tracks no logins). */
  active30d: number;
  activeSubscriptions: number;
  suspended: number;
};

export type AdminTopAiUser = { id: string; name: string; email: string; runs: number };

export type AdminUsersResponse = {
  kpis: AdminUsersKpis;
  distribution: Array<{ plan: string; count: number }>;
  avgRevenuePerUser: number;
  topAi: AdminTopAiUser[];
  table: {
    items: AdminUserItem[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};
