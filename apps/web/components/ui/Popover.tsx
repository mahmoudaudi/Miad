'use client';

import React, { useEffect, useId, useRef, useState } from 'react';

/** A disclosure with ordinary link/button semantics and optional arrow navigation. */
export function Popover({
  label,
  trigger,
  children,
  align = 'end',
  side = 'bottom',
  className = '',
  triggerClassName = '',
}: {
  label: string;
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: 'start' | 'end';
  side?: 'top' | 'bottom';
  className?: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>('button:not(:disabled),a[href]')?.focus();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape, true);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape, true);
    };
  }, [open]);
  return (
    <div
      ref={root}
      data-open={open ? 'true' : 'false'}
      className={`relative min-w-0 ${className}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.preventDefault();
          event.stopPropagation();
          event.nativeEvent.stopImmediatePropagation();
          setOpen(false);
          button.current?.focus();
        }
        if (!open || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
        const items = Array.from(
          panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href]') ?? []
        );
        if (!items.length) return;
        event.preventDefault();
        const i = items.indexOf(document.activeElement as HTMLElement);
        const next =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? items.length - 1
              : (i + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items[next]?.focus();
      }}
    >
      <button
        ref={button}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        className={`miad-button miad-button--ghost ${triggerClassName}`}
        onClick={() => setOpen((value) => !value)}
      >
        {trigger}
      </button>
      {open && (
        <div
          ref={panel}
          id={id}
          role="region"
          aria-label={label}
          className={`miad-popover ${align === 'end' ? 'end-0' : 'start-0'} ${side === 'top' ? 'bottom-[calc(100%+0.5rem)]' : 'top-[calc(100%+0.5rem)]'}`}
        >
          {children}
        </div>
      )}
    </div>
  );
}
