'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

export type ToastKind = 'success' | 'error';
type Toast = { id: number; message: string; kind: ToastKind; exiting: boolean };
type ToastContextValue = { showToast: (message: string, kind: ToastKind) => void };

const ToastContext = createContext<ToastContextValue | null>(null);
const EXIT_MS = 180;
const DISPLAY_MS = 4000;

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider.');
  return context.showToast;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismissToast = useCallback((id: number) => {
    const existing = timers.current.get(id);
    if (existing) clearTimeout(existing);
    setToasts((current) =>
      current.map((toast) => (toast.id === id ? { ...toast, exiting: true } : toast))
    );
    const timer = setTimeout(() => {
      timers.current.delete(id);
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, EXIT_MS);
    timers.current.set(id, timer);
  }, []);

  const showToast = useCallback(
    (message: string, kind: ToastKind) => {
      const id = ++nextId.current;
      setToasts((current) => [...current.slice(-2), { id, message, kind, exiting: false }]);
      timers.current.set(
        id,
        setTimeout(() => dismissToast(id), DISPLAY_MS)
      );
    },
    [dismissToast]
  );

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      timers.current.clear();
    },
    []
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        className="miad-toast-region"
        aria-label="Notifications"
        aria-live="polite"
        aria-relevant="additions"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.kind === 'error' ? 'alert' : 'status'}
            className={`miad-toast miad-toast--${toast.kind}${toast.exiting ? ' miad-toast--exit' : ''}`}
          >
            <span className="material-symbols-outlined miad-toast__icon" aria-hidden="true">
              {toast.kind === 'success' ? 'check_circle' : 'error'}
            </span>
            <span className="miad-toast__message">{toast.message}</span>
            <button
              type="button"
              className="miad-toast__close"
              aria-label="Dismiss notification"
              onClick={() => dismissToast(toast.id)}
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                close
              </span>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
