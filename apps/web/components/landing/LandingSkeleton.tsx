'use client';

import React from 'react';
import styles from './LandingSkeleton.module.css';

/**
 * Soft placeholder for a real content region. Reserved space is part of the
 * contract: callers size the element, so swapping in content never shifts the
 * layout.
 */
export function Skeleton({
  className = '',
  ...rest
}: { className?: string } & React.HTMLAttributes<HTMLSpanElement>) {
  return <span aria-hidden="true" className={`${styles.skeleton} ${className}`} {...rest} />;
}

/**
 * Inline blur placeholder for local brand imagery. next/image uses it to
 * upscale a single averaged pixel while the real file decodes, so the reveal is
 * a fade rather than a pop and no extra DOM is introduced.
 */
export const BRAND_BLUR_DATA_URL =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+PHJlY3Qgd2lkdGg9IjIwIiBoZWlnaHQ9IjIwIiBmaWxsPSIjZjdlZDVjIi8+PC9zdmc+';
