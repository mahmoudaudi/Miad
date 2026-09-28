/**
 * Invitations directory payload. The SaaS knows exactly two statuses
 * (PUBLISHED, DRAFT) — there is no archive, report, tag, or custom-domain
 * concept, so none is reported.
 */

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

export type AdminInvitationsKpis = {
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

export type AdminInvitationsResponse = {
  kpis: AdminInvitationsKpis;
  eventTypes: string[];
  table: {
    items: AdminInvitationItem[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type AdminTopViewedItem = {
  id: string;
  title: string;
  slug: string;
  views: number;
  views24h: number;
  rsvps: number;
};
