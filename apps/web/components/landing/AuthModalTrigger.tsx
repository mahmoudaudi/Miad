'use client';

import React from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { AuthMode } from './AuthModal';

export const AUTH_MODAL_OPEN_EVENT = 'miad:open-auth-modal';

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'onClick'> & {
  mode: AuthMode;
  children: ReactNode;
};

export function AuthModalTrigger({ mode, children, ...props }: Props) {
  return (
    <button
      {...props}
      type="button"
      data-auth-mode={mode}
      onClick={() => window.dispatchEvent(new CustomEvent(AUTH_MODAL_OPEN_EVENT, { detail: mode }))}
    >
      {children}
    </button>
  );
}
