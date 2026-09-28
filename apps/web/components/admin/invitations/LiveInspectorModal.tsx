'use client';

import React from 'react';
import type { AdminTopViewedItem } from '@/lib/admin';

/**
 * Live Event Inspector: top published invitations by total views, with real
 * 24h views and RSVP counts. Preview links open the public invitation.
 */
export function LiveInspectorModal({
  items,
  loading,
  onClose,
}: {
  items: AdminTopViewedItem[];
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Live event inspector"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[#1a1b22]/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[16px] font-semibold text-[#1a1b22]">Live Event Inspector</h2>
            <p className="text-[12px] text-[#47464b]">
              Most-viewed published invitations, with last-24h traffic.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close inspector"
            className="rounded-lg p-1.5 text-[#47464b] hover:bg-[#f4f2fd] hover:text-[#1a1b22]"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              close
            </span>
          </button>
        </div>
        {loading ? (
          <div aria-busy="true" aria-live="polite" className="mt-4 space-y-2">
            <span className="sr-only">Loading live traffic…</span>
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-[#f4f2fd]" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="mt-4 rounded-lg bg-[#f4f2fd] p-4 text-center text-[13px] text-[#47464b]">
            No published invitations with views yet.
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            {items.map((item, i) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-lg bg-[#f4f2fd] p-2.5"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="w-6 shrink-0 font-mono text-[11px] font-bold text-[#47464b]">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-[#1a1b22]">
                      {item.title}
                    </p>
                    <p className="font-mono text-[11px] text-[#47464b]">
                      {item.views.toLocaleString('en-US')} views •{' '}
                      {item.views24h.toLocaleString('en-US')} in 24h •{' '}
                      {item.rsvps.toLocaleString('en-US')} RSVPs
                    </p>
                  </div>
                </div>
                <a
                  href={`/invite/${encodeURIComponent(item.slug)}`}
                  target="_blank"
                  rel="noreferrer"
                  title="Preview invitation"
                  className="shrink-0 rounded-lg p-1.5 text-[#4648d4] hover:bg-white"
                >
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                    open_in_new
                  </span>
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
