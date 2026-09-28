/**
 * Community moderation payload. The SaaS stores published community designs
 * with view/like/save counters — but no reports, flags, bans, featured
 * markers, severities, or resolutions, so none is reported. Hiding
 * (unpublishing) is the real takedown equivalent.
 */

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

export type AdminCommunityKpis = {
  published: number;
  hidden: number;
  totalViews: number;
  totalLikes: number;
  newThisWeek: number;
};

export type AdminCommunityResponse = {
  kpis: AdminCommunityKpis;
  categories: string[];
  table: {
    items: AdminCommunityItem[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};
