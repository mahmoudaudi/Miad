import React from 'react';
import Image from 'next/image';
import styles from './admin.module.css';

/**
 * Left brand pane of the admin portal (server-safe, no hooks).
 * Burgundy gradient + grid micro-pattern + radial glows + logo + shimmer edge.
 */
export function AdminBrandPane() {
  return (
    <aside
      className={`relative flex flex-none flex-col justify-center overflow-hidden p-8 text-white sm:p-12 lg:w-1/2 lg:shrink-0 ${styles.brandPane}`}
      style={{ zIndex: 10 }}
      aria-hidden="true"
    >
      {/* Ambient radial glows + micro-pattern */}
      <div className={`pointer-events-none absolute inset-0 opacity-80 ${styles.bgPattern}`} />
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-[#8e1631]/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-[#a32742]/20 blur-3xl" />

      {/* Centered Miad logo showcase (same asset as the user app, white-inverted) */}
      <div className="relative z-10 m-auto flex w-full max-w-xl flex-col items-center justify-center p-6 sm:p-8">
        <div className="flex w-full items-center justify-center">
          <Image
            alt="Miad"
            src="/miad-logo.png"
            width={600}
            height={400}
            priority
            className={`h-auto w-full max-w-[320px] object-contain transition-transform duration-300 hover:scale-105 drop-shadow-2xl ${styles.logoImg}`}
          />
        </div>
      </div>

      {/* Diagonal shimmer edge */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 h-full w-full select-none"
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
      >
        <defs>
          <linearGradient id="admin-edge-glow" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#ffb2bb" stopOpacity="0.15" />
            <stop offset="35%" stopColor="#ffffff" stopOpacity="0.6" />
            <stop offset="65%" stopColor="#ffd9dc" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#fe738b" stopOpacity="0.1" />
          </linearGradient>
          <filter id="admin-glow-blur" width="140%" height="140%" x="-20%" y="-20%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="0.8" />
          </filter>
        </defs>
        <g className={styles.shimmerLine}>
          <line
            filter="url(#admin-glow-blur)"
            opacity="0.75"
            stroke="url(#admin-edge-glow)"
            strokeLinecap="round"
            strokeWidth="1.8"
            x1="75"
            x2="100"
            y1="0"
            y2="100"
          />
          <line
            opacity="0.9"
            stroke="url(#admin-edge-glow)"
            strokeWidth="0.6"
            x1="75"
            x2="100"
            y1="0"
            y2="100"
          />
        </g>
      </svg>
    </aside>
  );
}
