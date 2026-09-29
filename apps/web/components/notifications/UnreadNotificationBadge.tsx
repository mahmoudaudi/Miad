'use client';

import { useEffect, useState } from 'react';
import { getUnreadNotificationCount, NOTIFICATIONS_CHANGED_EVENT } from '@/lib/notifications';

export function UnreadNotificationBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      if (document.visibilityState === 'hidden') return;
      void getUnreadNotificationCount()
        .then((result) => { if (active) setCount(result.count); })
        .catch(() => { /* Keep the last known count during a temporary outage. */ });
    };
    refresh();
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
    };
  }, []);

  if (!count) return null;
  return <span className="ms-auto rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white" aria-label={`${count} unread notifications`}>{count > 99 ? '99+' : count}</span>;
}
