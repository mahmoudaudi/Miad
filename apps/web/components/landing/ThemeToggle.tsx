'use client';

import React, { useCallback, useEffect, useState } from 'react';

/** Shared with the pre-paint script in app/layout.tsx. */
const STORAGE_KEY = 'miad-theme';
const CHANGE_EVENT = 'miad-theme-change';

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background';

function prefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function storedTheme(): 'light' | 'dark' | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === 'dark' || value === 'light' ? value : null;
  } catch {
    // Private-mode or blocked storage: fall back to the system preference.
    return null;
  }
}

function applyTheme(theme: 'light' | 'dark'): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

/**
 * Small sun/moon control. Reads the system preference when the visitor has no
 * saved choice, persists an explicit choice, and keeps other open tabs in sync.
 * Rendered hidden until mounted so the server and client agree on the icon.
 */
export function ThemeToggle({
  className = '',
  variant = 'icon',
}: {
  className?: string;
  variant?: 'icon' | 'menu';
}) {
  const [theme, setTheme] = useState<'light' | 'dark' | null>(null);

  useEffect(() => {
    setTheme(storedTheme() ?? (prefersDark() ? 'dark' : 'light'));
  }, []);

  // Another tab changed the theme: adopt it without re-broadcasting.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      if (event.newValue !== 'dark' && event.newValue !== 'light') return;
      setTheme(event.newValue);
      applyTheme(event.newValue);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // The desktop and mobile account menus can both be mounted at once.
  useEffect(() => {
    const onThemeChange = () => {
      setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    };
    window.addEventListener(CHANGE_EVENT, onThemeChange);
    return () => window.removeEventListener(CHANGE_EVENT, onThemeChange);
  }, []);

  const toggle = useCallback(() => {
    const next = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
    applyTheme(next);
    setTheme(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // A failed write only costs persistence, never the toggle itself.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  const isDark = theme === 'dark';
  const label = isDark ? 'Switch to light theme' : 'Switch to dark theme';

  if (variant === 'menu') {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-label={label}
        aria-pressed={theme === null ? undefined : isDark}
        data-testid="theme-toggle"
        data-theme={theme ?? 'light'}
        className={`miad-menu-item flex w-full items-center gap-2 text-xs ${focusRing} ${className}`}
      >
        <span className="material-symbols-outlined text-[16px] text-muted" aria-hidden="true">
          {isDark ? 'light_mode' : 'dark_mode'}
        </span>
        {isDark ? 'Light theme' : 'Dark theme'}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      aria-pressed={theme === null ? undefined : isDark}
      title={label}
      data-testid="theme-toggle"
      data-theme={theme ?? 'light'}
      className={`relative flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-surface text-muted transition-colors hover:border-primary/25 hover:bg-secondary/50 hover:text-ink ${focusRing} ${className}`}
    >
      {/* Both glyphs are always mounted and cross-faded, so switching themes
          does not swap DOM and the icon cannot flash empty. */}
      <span
        className={`material-symbols-outlined text-[20px] leading-none transition-opacity duration-200 ${
          isDark ? 'opacity-0' : 'opacity-100'
        }`}
        aria-hidden="true"
      >
        dark_mode
      </span>
      <span
        className={`material-symbols-outlined absolute text-[20px] leading-none transition-opacity duration-200 ${
          isDark ? 'opacity-100' : 'opacity-0'
        }`}
        aria-hidden="true"
      >
        light_mode
      </span>
    </button>
  );
}
