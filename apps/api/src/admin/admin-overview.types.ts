/** Platform-wide overview payload for the admin portal. All numbers are real aggregates. */

export type AdminOverviewUsers = {
  total: number;
  active: number;
  activeRate: number;
  newLast24h: number;
};

export type AdminOverviewInvitations = { total: number; published: number; draft: number };

export type AdminOverviewRsvps = { total: number; attending: number; attendingRate: number };

export type AdminOverviewRevenue = { total: number; currency: string; activeSubscriptions: number };

export type AdminOverviewAi = {
  generations: number;
  refinements: number;
  successful: number;
  failed: number;
  successRate: number;
};

export type AdminOverviewSeriesPoint = { hour: string; successful: number; failed: number };

export type AdminActivityKind =
  | 'user_registered'
  | 'invitation_created'
  | 'invitation_published'
  | 'ai_completed'
  | 'ai_failed';

export type AdminActivityItem = {
  id: string;
  kind: AdminActivityKind;
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

export type AdminOverviewResponse = {
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
