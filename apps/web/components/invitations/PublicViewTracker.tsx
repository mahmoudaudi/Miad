'use client';

import { useEffect } from 'react';
import { recordPublicView } from '@/lib/analytics';

export function PublicViewTracker({ slug }: { slug: string }) {
  useEffect(() => {
    void recordPublicView(slug).catch(() => undefined);
  }, [slug]);
  return null;
}
