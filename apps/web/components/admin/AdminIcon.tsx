import React from 'react';
import styles from './admin.module.css';

export type AdminIconTone = 'burgundy' | 'indigo' | 'green' | 'amber' | 'slate' | 'red';

const TONES: Record<AdminIconTone, { tile: string; glyph: string }> = {
  burgundy: { tile: 'bg-gradient-to-br from-[#a32742] to-[#670e21]', glyph: 'text-white' },
  indigo: { tile: 'bg-gradient-to-br from-[#6063ee] to-[#4648d4]', glyph: 'text-white' },
  green: { tile: 'bg-gradient-to-br from-[#4edea3] to-[#005236]', glyph: 'text-white' },
  amber: { tile: 'bg-gradient-to-br from-[#e8b44a] to-[#875000]', glyph: 'text-white' },
  slate: { tile: 'bg-gradient-to-br from-[#eeedf7] to-[#e3e1ec]', glyph: 'text-[#47464b]' },
  red: { tile: 'bg-gradient-to-br from-[#e0655a] to-[#ba1a1a]', glyph: 'text-white' },
};

/**
 * Modern admin glyph: gradient tile + filled Material Symbol.
 * One component keeps every icon treatment in the portal consistent.
 */
export function AdminIcon({
  icon,
  tone = 'slate',
  size = 18,
  label,
}: {
  icon: string;
  tone?: AdminIconTone;
  size?: 16 | 18 | 20 | 24;
  label?: string;
}) {
  const theme = TONES[tone];
  const box = size >= 24 ? 'h-10 w-10' : size >= 20 ? 'h-9 w-9' : 'h-8 w-8';
  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={`flex ${box} shrink-0 items-center justify-center rounded-xl shadow-sm ${theme.tile}`}
    >
      <span
        aria-hidden="true"
        className={`material-symbols-outlined ${styles.symbolFilled} ${theme.glyph}`}
        style={{ fontSize: size }}
      >
        {icon}
      </span>
    </span>
  );
}
