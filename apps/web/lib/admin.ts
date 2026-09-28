import { authenticatedApiClient } from './api-client';

/** Mirrors apps/api/src/admin/admin-overview.types.ts. */

export type AdminOverviewUsers = {
  total: number;
  active: number;
  activeRate: number;
  newLast24h: number;
};

export type AdminOverviewInvitations = { total: number; published: number; draft: number };

export type AdminOverviewRsvps = { total: number; attending: number; attendingRate: number };

export type AdminOverviewRevenue = {
  total: number;
  currency: string;
  activeSubscriptions: number;
};

export type AdminOverviewAi = {
  generations: number;
  refinements: number;
  successful: number;
  failed: number;
  successRate: number;
};

export type AdminOverviewSeriesPoint = { hour: string; successful: number; failed: number };

export type AdminActivityItem = {
  id: string;
  kind:
    | 'user_registered'
    | 'invitation_created'
    | 'invitation_published'
    | 'ai_completed'
    | 'ai_failed';
  title: string;
  detail: string;
  occurredAt: string;
};

export type AdminGenerationItem = {
  id: string;
  userName: string;
  userEmail: string;
  invitationName: string;
  invitationSlug: string;
  operation: string;
  tokensUsed: number | null;
  status: string;
  createdAt: string;
};

export type AdminOverview = {
  users: AdminOverviewUsers;
  invitations: AdminOverviewInvitations;
  rsvps: AdminOverviewRsvps;
  revenue: AdminOverviewRevenue;
  ai: AdminOverviewAi;
  series: AdminOverviewSeriesPoint[];
  activity: AdminActivityItem[];
  generations: {
    items: AdminGenerationItem[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export function getAdminOverview(page = 1, limit = 6): Promise<AdminOverview> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  return authenticatedApiClient<AdminOverview>(`/admin/overview?${params.toString()}`);
}

export type AdminOverviewSummary = Omit<AdminOverview, 'generations'>;
export type AdminGenerations = AdminOverview['generations'];

/** True for fetch cancellations — these must never surface as error toasts. */
export function isAbortError(error: unknown): boolean {
  return (
    (typeof DOMException !== 'undefined' &&
      error instanceof DOMException &&
      error.name === 'AbortError') ||
    (typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      (error as { name: unknown }).name === 'AbortError')
  );
}

/** Generations page alone (table page turns skip the heavy aggregates). */
export function getOverviewGenerations(
  page = 1,
  limit = 6,
  signal?: AbortSignal
): Promise<AdminGenerations> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  return authenticatedApiClient<AdminGenerations>(
    `/admin/overview/generations?${params.toString()}`,
    signal ? { signal } : undefined
  );
}

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

export type AdminUsersFilters = {
  search?: string;
  plan?: string;
  status?: 'active' | 'suspended';
  joined?: '7d' | '30d';
  sort?: 'newest' | 'invitations' | 'aiRuns';
  page?: number;
  limit?: number;
};

export type AdminUsersResponse = {
  kpis: {
    total: number;
    newThisWeek: number;
    growthRate: number;
    active30d: number;
    activeSubscriptions: number;
    suspended: number;
  };
  distribution: Array<{ plan: string; count: number }>;
  avgRevenuePerUser: number;
  topAi: Array<{ id: string; name: string; email: string; runs: number }>;
  table: {
    items: AdminUserItem[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export function getAdminUsers(filters: AdminUsersFilters): Promise<AdminUsersResponse> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const query = params.toString();
  return authenticatedApiClient<AdminUsersResponse>(`/admin/users${query ? `?${query}` : ''}`);
}

export type AdminUsersSummary = Omit<AdminUsersResponse, 'table'>;
export type AdminUsersTable = AdminUsersResponse['table'];

function filtersQuery(filters: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  return params.toString();
}

/** KPIs + distribution (fetched once per filter set, not per page). */
export function getUsersSummary(): Promise<AdminUsersSummary> {
  return authenticatedApiClient<AdminUsersSummary>('/admin/users/summary');
}

/** Directory table page alone. */
export function getUsersTable(
  filters: AdminUsersFilters,
  signal?: AbortSignal
): Promise<AdminUsersTable> {
  const query = filtersQuery(filters);
  return authenticatedApiClient<AdminUsersTable>(
    `/admin/users/table${query ? `?${query}` : ''}`,
    signal ? { signal } : undefined
  );
}

export function createAdminUser(input: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: string;
}): Promise<AdminUserItem> {
  return authenticatedApiClient<AdminUserItem>('/admin/users', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function setAdminUserStatus(id: string, isActive: boolean): Promise<{ id: string; isActive: boolean }> {
  return authenticatedApiClient(`/admin/users/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  });
}

export function setAdminUserRole(id: string, role: string): Promise<{ id: string; role: string }> {
  return authenticatedApiClient(`/admin/users/${encodeURIComponent(id)}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

export function deleteAdminUser(id: string): Promise<{ id: string; deleted: boolean }> {
  return authenticatedApiClient(`/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export type AdminInvitationItem = {
  id: string;
  title: string;
  slug: string;
  eventType: string;
  status: 'PUBLISHED' | 'DRAFT';
  createdAt: string;
  updatedAt: string;
  owner: { name: string; email: string; plan: string };
  views: number;
  rsvps: number;
};

export type AdminInvitationsFilters = {
  search?: string;
  status?: 'PUBLISHED' | 'DRAFT';
  eventType?: string;
  created?: '7d' | '30d';
  sort?: 'newest' | 'mostViewed' | 'mostRsvps';
  page?: number;
  limit?: number;
};

export type AdminInvitationsResponse = {
  kpis: {
    total: number;
    published: number;
    draft: number;
    publishedRate: number;
    newThisWeek: number;
    growthRate: number;
    totalViews: number;
    totalRsvps: number;
    creations30d: number[];
    published30d: number[];
  };
  eventTypes: string[];
  table: {
    items: AdminInvitationItem[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type AdminInvitationAnalytics = {
  views: number;
  uniqueVisitors: number;
  rsvps: number;
  attending: number;
  notAttending: number;
  pending: number;
  attendingGuests: number;
};

export type AdminTopViewedItem = {
  id: string;
  title: string;
  slug: string;
  views: number;
  views24h: number;
  rsvps: number;
};

export function getAdminInvitations(filters: AdminInvitationsFilters): Promise<AdminInvitationsResponse> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const query = params.toString();
  return authenticatedApiClient<AdminInvitationsResponse>(
    `/admin/invitations${query ? `?${query}` : ''}`
  );
}

export type AdminInvitationsSummary = Omit<AdminInvitationsResponse, 'table'>;
export type AdminInvitationsTable = AdminInvitationsResponse['table'];

/** KPIs + event types (fetched once, not per page). */
export function getInvitationsSummary(): Promise<AdminInvitationsSummary> {
  return authenticatedApiClient<AdminInvitationsSummary>('/admin/invitations/summary');
}

/** Directory table page alone. */
export function getInvitationsTable(
  filters: AdminInvitationsFilters,
  signal?: AbortSignal
): Promise<AdminInvitationsTable> {
  const query = filtersQuery(filters);
  return authenticatedApiClient<AdminInvitationsTable>(
    `/admin/invitations/table${query ? `?${query}` : ''}`,
    signal ? { signal } : undefined
  );
}

export function getAdminTopViewed(): Promise<AdminTopViewedItem[]> {
  return authenticatedApiClient<AdminTopViewedItem[]>('/admin/invitations/top-viewed');
}

export function getAdminInvitationAnalytics(id: string): Promise<AdminInvitationAnalytics> {
  return authenticatedApiClient<AdminInvitationAnalytics>(
    `/admin/invitations/${encodeURIComponent(id)}/analytics`
  );
}

export function setAdminInvitationStatus(
  id: string,
  status: 'PUBLISHED' | 'DRAFT'
): Promise<{ id: string; status: string }> {
  return authenticatedApiClient(`/admin/invitations/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export function bulkAdminInvitationStatus(
  ids: string[],
  status: 'PUBLISHED' | 'DRAFT'
): Promise<{ updated: number; total: number }> {
  return authenticatedApiClient('/admin/invitations/bulk-status', {
    method: 'PATCH',
    body: JSON.stringify({ ids, status }),
  });
}

export function deleteAdminInvitation(id: string): Promise<{ id: string; deleted: boolean }> {
  return authenticatedApiClient(`/admin/invitations/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

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

export type AdminAiTelemetry = {
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

export function getAdminAiTelemetry(failPage = 1, failLimit = 5): Promise<AdminAiTelemetry> {
  const params = new URLSearchParams({ failPage: String(failPage), failLimit: String(failLimit) });
  return authenticatedApiClient<AdminAiTelemetry>(`/admin/ai-telemetry?${params.toString()}`);
}

export type AdminAiFailures = AdminAiTelemetry['failures'];

/** Failures page alone (table page turns skip the aggregates). */
export function getAiFailures(failPage = 1, failLimit = 5): Promise<AdminAiFailures> {
  const params = new URLSearchParams({ failPage: String(failPage), failLimit: String(failLimit) });
  return authenticatedApiClient<AdminAiFailures>(
    `/admin/ai-telemetry/failures?${params.toString()}`
  );
}

export type AdminBillingKpis = {
  totalRevenue: number;
  currency: string;
  mrr: number;
  activeSubscriptions: number;
  newSubs30d: number;
  endedSubs: number;
  churnRate: number;
};

export type AdminBillingTier = {
  plan: string;
  price: number;
  interval: string;
  subscribers: number;
  mrr: number;
};

export type AdminTransaction = {
  id: string;
  reference: string;
  customerName: string;
  customerEmail: string;
  plan: string;
  amount: number;
  currency: string;
  cycle: string;
  status: string;
  processedAt: string;
};

export type AdminBilling = {
  kpis: AdminBillingKpis;
  monthly: Array<{ month: string; mrr: number }>;
  tiers: AdminBillingTier[];
  transactions: {
    items: AdminTransaction[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    gross: number;
  };
};

export function getAdminBilling(txPage = 1, txLimit = 6): Promise<AdminBilling> {
  const params = new URLSearchParams({ txPage: String(txPage), txLimit: String(txLimit) });
  return authenticatedApiClient<AdminBilling>(`/admin/billing?${params.toString()}`);
}

export type AdminTransactions = AdminBilling['transactions'];

/** Transactions page alone (page turns skip the aggregates). */
export function getBillingTransactions(txPage = 1, txLimit = 6): Promise<AdminTransactions> {
  const params = new URLSearchParams({ txPage: String(txPage), txLimit: String(txLimit) });
  return authenticatedApiClient<AdminTransactions>(
    `/admin/billing/transactions?${params.toString()}`
  );
}

export type AdminCommunityItem = {
  id: string;
  title: string;
  slug: string;
  category: string;
  isPublished: boolean;
  views: number;
  likes: number;
  saves: number;
  createdAt: string;
  updatedAt: string;
  creator: { name: string; email: string };
  invitationSlug: string;
};

export type AdminCommunityFilters = {
  search?: string;
  category?: string;
  status?: 'published' | 'hidden';
  sort?: 'newest' | 'mostViewed' | 'mostLiked';
  page?: number;
  limit?: number;
};

export type AdminCommunity = {
  kpis: {
    published: number;
    hidden: number;
    totalViews: number;
    totalLikes: number;
    newThisWeek: number;
  };
  categories: string[];
  table: {
    items: AdminCommunityItem[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export function getAdminCommunity(filters: AdminCommunityFilters): Promise<AdminCommunity> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const query = params.toString();
  return authenticatedApiClient<AdminCommunity>(
    `/admin/community${query ? `?${query}` : ''}`
  );
}

export type AdminCommunitySummary = Omit<AdminCommunity, 'table'>;
export type AdminCommunityTable = AdminCommunity['table'];

/** KPIs + categories (fetched once, not per page). */
export function getCommunitySummary(): Promise<AdminCommunitySummary> {
  return authenticatedApiClient<AdminCommunitySummary>('/admin/community/summary');
}

/** Showcase table page alone. */
export function getCommunityTable(filters: AdminCommunityFilters): Promise<AdminCommunityTable> {
  const query = filtersQuery(filters);
  return authenticatedApiClient<AdminCommunityTable>(
    `/admin/community/table${query ? `?${query}` : ''}`
  );
}

export function setCommunityPublication(
  id: string,
  isPublished: boolean
): Promise<{ id: string; isPublished: boolean }> {
  return authenticatedApiClient(`/admin/community/${encodeURIComponent(id)}/publication`, {
    method: 'PATCH',
    body: JSON.stringify({ isPublished }),
  });
}

export function deleteCommunityDesign(id: string): Promise<{ id: string; deleted: boolean }> {
  return authenticatedApiClient(`/admin/community/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export type AdminAnalyticsRange = {
  from: string;
  to: string;
  label: string;
};

export type AdminAnalytics = {
  range: AdminAnalyticsRange;
  kpis: {
    newUsers: number;
    newUsersTrend: number;
    activeCreators: number;
    published: number;
    publishedRate: number;
    rsvpResponses: number;
    rsvpRate: number;
  };
  daily: Array<{ day: string; created: number; published: number; views: number }>;
  funnel: { created: number; published: number; opened: number };
  rsvp: { attending: number; notAttending: number; pending: number; attendingGuests: number };
  ai: { generations: number; refinements: number; successful: number; failed: number; successRate: number };
  devices: Array<{ device: string; views: number }>;
  top: Array<{ id: string; title: string; slug: string; views: number; rsvps: number }>;
};

export type AdminAnalyticsParams = {
  range?: '7d' | '30d' | '90d';
  from?: string;
  to?: string;
};

export function getAdminAnalytics(params: AdminAnalyticsParams = {}): Promise<AdminAnalytics> {
  const query = new URLSearchParams();
  if (params.range) query.set('range', params.range);
  if (params.from) query.set('from', params.from);
  if (params.to) query.set('to', params.to);
  const suffix = query.toString();
  return authenticatedApiClient<AdminAnalytics>(`/admin/analytics${suffix ? `?${suffix}` : ''}`);
}

/** Downloads the daily buckets behind the charts as CSV. */
export function downloadAnalyticsCsv(data: AdminAnalytics): void {
  const header = ['Day', 'Created', 'Published', 'Views'];
  const lines = data.daily.map((d) =>
    [csvCell(d.day.slice(0, 10)), csvCell(d.created), csvCell(d.published), csvCell(d.views)].join(',')
  );
  const blob = new Blob([[header.join(','), ...lines].join('\n')], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'admin-analytics.csv';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** Downloads the given community designs as CSV. */
export function downloadCommunityCsv(items: AdminCommunityItem[]): void {
  const header = ['Title', 'Slug', 'Category', 'Creator', 'Email', 'Status', 'Views', 'Likes', 'Saves', 'Updated'];
  const lines = items.map((item) =>
    [
      csvCell(item.title),
      csvCell(item.slug),
      csvCell(item.category),
      csvCell(item.creator.name),
      csvCell(item.creator.email),
      csvCell(item.isPublished ? 'Published' : 'Hidden'),
      csvCell(item.views),
      csvCell(item.likes),
      csvCell(item.saves),
      csvCell(item.updatedAt),
    ].join(',')
  );
  const blob = new Blob([[header.join(','), ...lines].join('\n')], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'admin-community.csv';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** Downloads the given transactions as CSV. */
export function downloadTransactionsCsv(items: AdminTransaction[]): void {
  const header = ['Reference', 'Customer', 'Email', 'Plan', 'Amount', 'Currency', 'Cycle', 'Status', 'Processed'];
  const lines = items.map((item) =>
    [
      csvCell(item.reference),
      csvCell(item.customerName),
      csvCell(item.customerEmail),
      csvCell(item.plan),
      csvCell(item.amount),
      csvCell(item.currency),
      csvCell(item.cycle),
      csvCell(item.status),
      csvCell(item.processedAt),
    ].join(',')
  );
  const blob = new Blob([[header.join(','), ...lines].join('\n')], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'admin-transactions.csv';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** Downloads the given invitations as CSV. */
export function downloadInvitationsCsv(items: AdminInvitationItem[]): void {
  const header = ['Title', 'Slug', 'Owner', 'Owner email', 'Type', 'Status', 'Created', 'Views', 'RSVPs'];
  const lines = items.map((item) =>
    [
      csvCell(item.title),
      csvCell(item.slug),
      csvCell(item.owner.name),
      csvCell(item.owner.email),
      csvCell(item.eventType),
      csvCell(item.status),
      csvCell(item.createdAt),
      csvCell(item.views),
      csvCell(item.rsvps),
    ].join(',')
  );
  const blob = new Blob([[header.join(','), ...lines].join('\n')], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'admin-invitations.csv';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** Downloads the currently loaded users page as CSV. */
export function downloadUsersCsv(items: AdminUserItem[]): void {
  const header = ['Name', 'Email', 'Role', 'Plan', 'Status', 'Registered', 'Invitations', 'AI runs'];
  const lines = items.map((item) =>
    [
      csvCell(`${item.firstName} ${item.lastName}`.trim()),
      csvCell(item.email),
      csvCell(item.role),
      csvCell(item.plan),
      csvCell(item.isActive ? 'Active' : 'Suspended'),
      csvCell(item.createdAt),
      csvCell(item.invitationsCount),
      csvCell(item.aiRuns),
    ].join(',')
  );
  const blob = new Blob([[header.join(','), ...lines].join('\n')], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'admin-users.csv';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function formatCompact(value: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(
    value
  );
}

export function formatMoney(total: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: total % 1 === 0 ? 0 : 2,
    }).format(total);
  } catch {
    return `${total} ${currency}`;
  }
}

export function timeAgo(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return `${first}${last}`.toUpperCase() || '?';
}

function csvCell(value: string | number | null): string {
  const text = value === null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Downloads the currently loaded generations page as CSV. */
export function downloadGenerationsCsv(items: AdminGenerationItem[]): void {
  const header = ['User', 'Email', 'Invitation', 'Operation', 'Tokens', 'Status', 'Created'];
  const lines = items.map((item) =>
    [
      csvCell(item.userName),
      csvCell(item.userEmail),
      csvCell(item.invitationName),
      csvCell(item.operation),
      csvCell(item.tokensUsed),
      csvCell(item.status),
      csvCell(item.createdAt),
    ].join(',')
  );
  const blob = new Blob([[header.join(','), ...lines].join('\n')], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'admin-ai-generations.csv';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
