'use client';

import React, { useEffect, useRef } from 'react';
import styles from './Reveal.module.css';

/**
 * Subtle scroll reveal for section headings. CSS-only motion
 * (transform/opacity), fires once, honors prefers-reduced-motion.
 */
export function Reveal({
  children,
  className = '',
  as: Tag = 'div',
}: {
  children: React.ReactNode;
  className?: string;
  as?: 'div' | 'span';
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    const revealedClass = styles.revealed ?? 'is-revealed';
    if (!el || !revealedClass) return;
    if (
      !('IntersectionObserver' in window) ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      el.classList.add(revealedClass);
      return;
    }
    if (el.getBoundingClientRect().top < window.innerHeight) return;
    if (styles.pending) el.classList.add(styles.pending);
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          el.classList.add(revealedClass);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag ref={ref as never} className={`${styles.reveal} ${className}`}>
      {children}
    </Tag>
  );
}
