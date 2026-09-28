/**
 * Platform analytics payload. Everything derives from stored rows (users,
 * events, invitations, views, RSVPs, AI usage) inside the selected window.
 * The SaaS tracks no logins, shares, browsers, or latencies, so DAU/WAU,
 * funnels beyond publish, channels, devices-by-browser, and latency panels
 * don't exist here.
 */

export type AdminAnalyticsKpis = {
  newUsers: number;
  newUsersTrend: number;
  activeCreators: number;
  published: number;
  publishedRate: number;
  rsvpResponses: number;
  rsvpRate: number;
};

export type AdminAnalyticsDay = {
  day: string;
  created: number;
  published: number;
  views: number;
};

export type AdminAnalyticsRsvp = {
  attending: number;
  notAttending: number;
  pending: number;
  attendingGuests: number;
};

export type AdminAnalyticsAi = {
  generations: number;
  refinements: number;
  successful: number;
  failed: number;
  successRate: number;
};

export type AdminAnalyticsDevice = { device: string; views: number };

export type AdminAnalyticsTop = {
  id: string;
  title: string;
  slug: string;
  views: number;
  rsvps: number;
};

export type AdminAnalyticsResponse = {
  range: { from: string; to: string; label: string };
  kpis: AdminAnalyticsKpis;
  daily: AdminAnalyticsDay[];
  funnel: { created: number; published: number; opened: number };
  rsvp: AdminAnalyticsRsvp;
  ai: AdminAnalyticsAi;
  devices: AdminAnalyticsDevice[];
  top: AdminAnalyticsTop[];
};
