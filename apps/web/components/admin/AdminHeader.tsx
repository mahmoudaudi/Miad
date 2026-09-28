'use client';

import React from 'react';

const SECTION_LABELS: Record<string, string> = {
  overview: 'Overview',
  users: 'Users Management',
  invitations: 'Invitations Directory',
  community: 'Community Moderation',
  'ai-engine': 'AI Engine Telemetry',
  billing: 'Billing & Subscriptions',
  analytics: 'Platform Analytics',
};

/** Slim fixed admin header: section breadcrumb only. */
export function AdminHeader({ section }: { section: string }) {
  return (
    <header className="fixed left-0 right-0 top-0 z-40 flex h-14 items-center border-b border-[#e3e1ec] bg-white/90 px-4 backdrop-blur-md lg:left-64 lg:px-8">
      <div className="flex items-center gap-1.5 text-[13px] text-[#47464b]">
        <span className="text-[#47464b]/80">Platform</span>
        <span className="text-[#c8c5cb]">/</span>
        <span className="font-medium text-[#1a1b22]">{SECTION_LABELS[section] ?? section}</span>
      </div>
    </header>
  );
}
