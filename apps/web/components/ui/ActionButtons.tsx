'use client';
import React, { useEffect, useRef, useState } from 'react';
import { Button, type ButtonProps } from '../Button';

export type ActionState = 'idle' | 'loading' | 'success' | 'error';
type ActionProps = Omit<ButtonProps, 'children'> & {
  state?: ActionState;
  label: string;
  busyLabel: string;
  successLabel?: string;
  errorLabel?: string;
};

function ActionButton({
  state = 'idle',
  label,
  busyLabel,
  successLabel = 'Done',
  errorLabel = 'Retry',
  kind,
  className = '',
  onClick,
  disabled,
  ...rest
}: ActionProps & { kind: 'publish' | 'delete' | 'send' }) {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    setSettled(false);
    if (state !== 'success') return;
    const timeout = setTimeout(() => setSettled(true), 1600);
    return () => clearTimeout(timeout);
  }, [state]);
  const visualState = state === 'success' && settled ? 'idle' : state;
  const lock = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (state !== 'loading') lock.current = false;
  }, [state]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const text =
    visualState === 'loading'
      ? busyLabel
      : visualState === 'success'
        ? successLabel
        : visualState === 'error'
          ? errorLabel
          : label;
  return (
    <Button
      {...rest}
      disabled={disabled || state === 'loading'}
      busy={state === 'loading'}
      data-state={visualState}
      className={`miad-action ${kind === 'send' ? 'miad-send' : ''} ${className}`}
      onClick={(event) => {
        if (lock.current) {
          event.preventDefault();
          return;
        }
        lock.current = true;
        // Blocks same-frame repeated clicks; request state owns the longer lock.
        timer.current = setTimeout(() => {
          lock.current = false;
        }, 300);
        onClick?.(event);
      }}
    >
      <span
        className={`miad-action-icon ${kind === 'delete' ? 'miad-delete-icon' : ''}`}
        aria-hidden="true"
      >
        <span className="material-symbols-outlined text-lg">
          {visualState === 'success'
            ? 'check'
            : state === 'error'
              ? 'refresh'
              : kind === 'delete'
                ? 'delete'
                : kind === 'send'
                  ? 'north_east'
                  : 'publish'}
        </span>
      </span>
      <span className={kind === 'delete' ? 'miad-delete-label' : ''}>
        <span key={text} className="miad-action-label">
          {text}
        </span>
      </span>
    </Button>
  );
}

export function PublishButton(props: ActionProps) {
  return <ActionButton {...props} kind="publish" />;
}
export function DeleteButton(props: ActionProps) {
  return <ActionButton variant="destructive" {...props} kind="delete" />;
}
export function SendButton(props: ActionProps) {
  return <ActionButton {...props} kind="send" />;
}
