import React, { forwardRef, type ButtonHTMLAttributes } from 'react';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  busy?: boolean;
};

const variants = {
  primary: 'miad-button--primary',
  secondary: 'miad-button--secondary',
  ghost: 'miad-button--ghost',
  destructive: 'miad-button--destructive',
} as const;

/** Shared control; native button semantics and caller-supplied accessible name. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    children,
    className = '',
    variant = 'primary',
    busy = false,
    disabled,
    type = 'button',
    ...rest
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`miad-button ${variants[variant]} ${className}`}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...rest}
    >
      {children}
    </button>
  );
});
