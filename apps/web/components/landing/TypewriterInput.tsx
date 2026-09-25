'use client';

import React, { forwardRef, useEffect, useState } from 'react';

const PHRASES_FALLBACK = ['…'] as const;

const TYPE_MS = 55;
const DELETE_MS = 25;
const HOLD_MS = 1600;
const START_MS = 500;

/** Prompt input with a looping letter-by-letter placeholder. */
export const TypewriterInput = forwardRef<
  HTMLInputElement,
  {
    value?: string;
    onChange?: (value: string) => void;
    ariaLabel: string;
    phrases?: readonly string[];
  }
>(function TypewriterInput({ value, onChange, ariaLabel, phrases }, ref) {
  const activePhrases = phrases && phrases.length > 0 ? phrases : PHRASES_FALLBACK;
  const [focused, setFocused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const [placeholder, setPlaceholder] = useState<string>(activePhrases[0] ?? '');

  useEffect(() => {
    if (reducedMotion || focused || value) {
      setPlaceholder(activePhrases[0] ?? '');
      return;
    }
    let phrase = 0;
    let chars = 0;
    let deleting = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      const current = activePhrases[phrase % activePhrases.length] ?? '';
      if (!deleting) {
        chars += 1;
        setPlaceholder(current.slice(0, chars));
        timer = setTimeout(tick, chars >= current.length ? HOLD_MS : TYPE_MS);
        if (chars >= current.length) deleting = true;
      } else {
        chars -= 1;
        setPlaceholder(current.slice(0, Math.max(chars, 0)));
        if (chars <= 0) {
          deleting = false;
          phrase += 1;
          timer = setTimeout(tick, 350);
        } else {
          timer = setTimeout(tick, DELETE_MS);
        }
      }
    };

    timer = setTimeout(tick, START_MS);
    return () => clearTimeout(timer);
  }, [activePhrases, focused, reducedMotion, value]);

  return (
    <input
      ref={ref}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      aria-label={ariaLabel}
      className="w-full bg-transparent border-none text-body-lg text-ink placeholder:text-muted focus:outline-none"
      placeholder={placeholder}
      type="text"
      maxLength={2000}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
    />
  );
});
