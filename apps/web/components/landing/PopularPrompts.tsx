'use client';

import React, { useEffect, useState } from 'react';

const VISIBLE_COUNT = 3;

function pickThree(pool: readonly string[], exclude: readonly string[] = []): string[] {
  const available = pool.filter((p) => !exclude.includes(p));
  const source: string[] = available.length >= VISIBLE_COUNT ? [...available] : [...pool];
  const shuffled: string[] = [...source];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = shuffled[i] ?? '';
    const b = shuffled[j] ?? '';
    shuffled[i] = b;
    shuffled[j] = a;
  }
  return shuffled.slice(0, VISIBLE_COUNT);
}

/** Popular prompts with a shuffle button (visual only for now). */
export function PopularPrompts({
  prompts,
  examplesLabel,
  shuffleLabel,
  onSelect,
}: {
  prompts: readonly string[];
  examplesLabel: string;
  shuffleLabel: string;
  onSelect?: (prompt: string) => void;
}) {
  // Deterministic first render (identical on server + client) to avoid
  // hydration mismatch — randomness only kicks in after mount.
  const [visible, setVisible] = useState<string[]>(() => prompts.slice(0, VISIBLE_COUNT));
  const [spins, setSpins] = useState(0);

  useEffect(() => {
    setVisible(pickThree(prompts));
  }, [prompts]);

  const shuffle = () => {
    setSpins((n) => n + 1);
    setVisible((current) => {
      const next = pickThree(prompts, current);
      if (next.every((p, i) => p === current[i])) return pickThree(prompts);
      return next;
    });
  };

  return (
    <div className="mt-6 flex w-full flex-col items-center gap-3">
      <span className="text-body-sm text-muted">{examplesLabel}</span>
      <div className="flex flex-wrap items-center justify-center gap-2 text-body-sm text-muted">
        {visible.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onSelect?.(prompt)}
            className="min-h-10 rounded-full border border-line bg-surface px-4 py-2 transition-colors hover:border-muted/40"
          >
            {prompt}
          </button>
        ))}
        <button
          type="button"
          onClick={shuffle}
          aria-label={shuffleLabel}
          title={shuffleLabel}
          className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-ink/5"
        >
          <span
            className="material-symbols-outlined text-base text-muted transition-transform duration-500"
            style={{ transform: `rotate(${spins * 180}deg)` }}
          >
            sync
          </span>
        </button>
      </div>
    </div>
  );
}
