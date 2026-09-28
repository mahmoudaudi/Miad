'use client';

import React, { useEffect, useRef } from 'react';

export function HtmlInvitationFrame({
  src,
  title,
  className = 'min-h-[32rem] w-full',
  fullPage = false,
}: {
  src: string;
  title: string;
  className?: string;
  /** Size the same-origin, script-disabled public document to its content. */
  fullPage?: boolean;
}) {
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!fullPage || !frame.current) return;
    const node = frame.current;

    const measure = () => {
      const document = node.contentDocument;
      if (!document) return;
      const height = Math.ceil(
        Math.max(
          window.innerHeight,
          document.documentElement.scrollHeight,
          document.body?.scrollHeight ?? 0
        )
      );
      node.style.height = `${height}px`;
    };

    node.addEventListener('load', measure);
    if (node.contentDocument?.readyState === 'complete') measure();
    const document = node.contentDocument;
    const observer =
      document && typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(measure)
        : null;
    if (document) {
      observer?.observe(document.documentElement);
      if (document.body) observer?.observe(document.body);
      void document.fonts?.ready.then(measure);
    }

    return () => {
      node.removeEventListener('load', measure);
      observer?.disconnect();
    };
  }, [fullPage, src]);

  return (
    <iframe
      ref={frame}
      title={title}
      src={src}
      // The public render response has script-src 'none' and sanitized markup.
      // Same-origin access is only used by the parent to measure long documents.
      sandbox={fullPage ? 'allow-same-origin' : ''}
      referrerPolicy="no-referrer"
      loading={fullPage ? 'eager' : 'lazy'}
      className={`block border-0 bg-transparent ${className}`}
    />
  );
}
