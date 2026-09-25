'use client';

import React, { createContext, useContext, useMemo } from 'react';
import { defaultLocale, type Locale } from './locales';

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue>({
  locale: defaultLocale,
  setLocale: () => undefined,
});

/**
 * English-only locale stub. Kept so the ~20 components using
 * `useLocale()` / `<LocaleProvider>` keep working untouched.
 * `setLocale` is a no-op (no language switching for now).
 */
export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale?: Locale;
  children: React.ReactNode;
}) {
  const value = useMemo(() => ({ locale: 'en' as Locale, setLocale: () => undefined }), []);
  void initialLocale;
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext);
}
