import React from 'react';

export function HtmlInvitationFrame({
  src,
  title,
  className = 'min-h-[32rem] w-full',
}: {
  src: string;
  title: string;
  className?: string;
}) {
  return (
    <iframe
      title={title}
      src={src}
      sandbox=""
      referrerPolicy="no-referrer"
      loading="lazy"
      className={`border-0 bg-white ${className}`}
    />
  );
}
