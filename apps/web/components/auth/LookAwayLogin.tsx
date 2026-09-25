'use client';
import React, { useEffect, useRef } from 'react';

/** Receives focus state only. Password values never reach this component. */
export function LookAwayLogin({ passwordFocused }: { passwordFocused: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    const move = (event: PointerEvent) => {
      if (preference.matches || passwordFocused || event.pointerType !== 'mouse') return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const el = root.current;
        if (!el) return;
        const bounds = el.getBoundingClientRect();
        el.style.setProperty(
          '--eye-x',
          `${Math.max(-4, Math.min(4, (event.clientX - bounds.left - bounds.width / 2) / 80))}px`
        );
        el.style.setProperty(
          '--eye-y',
          `${Math.max(-3, Math.min(3, (event.clientY - bounds.top) / 100))}px`
        );
      });
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', move);
    };
  }, [passwordFocused]);
  return (
    <div ref={root} className="miad-characters mb-2" data-away={passwordFocused} aria-hidden="true">
      {[0, 1, 2, 3].map((character) => (
        <span className="miad-character" key={character}>
          <span className="miad-eyes">
            <i />
            <i />
          </span>
        </span>
      ))}
    </div>
  );
}
