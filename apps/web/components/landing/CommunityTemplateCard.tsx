import React from 'react';
import type { CommunityDesignRecord } from '@/lib/community';
import {
  CommunityDesignPreview,
  communityPreviewFor,
} from '@/components/templates/CommunityDesignPreview';
import { AuthModalTrigger } from './AuthModalTrigger';

export function CommunityTemplateCard({
  design,
  actionLabel,
}: {
  design: CommunityDesignRecord;
  actionLabel: string;
}) {
  return (
    <AuthModalTrigger
      mode="register"
      aria-label={`${actionLabel}: ${design.title}`}
      className="group block w-full min-w-0 overflow-hidden rounded-xl border border-line bg-surface text-start shadow-subtle transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      <div aria-hidden="true" className="aspect-[4/3] overflow-hidden">
        <CommunityDesignPreview
          title={design.title}
          category={design.category}
          preview={communityPreviewFor(design.specification)}
        />
      </div>
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <span className="block truncate text-sm font-medium text-ink">{design.title}</span>
          <span className="block truncate text-xs text-muted">By {design.creator.name}</span>
        </div>
        <span className="material-symbols-outlined text-lg text-primary" aria-hidden="true">
          arrow_outward
        </span>
      </div>
    </AuthModalTrigger>
  );
}
