'use client';

import React, { useState } from 'react';
import type { SmartQuestion, SmartQuestionType } from '@/lib/ai-studio';

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9f1239] focus-visible:ring-offset-1';

const TYPE_PLACEHOLDER: Record<SmartQuestionType, string> = {
  single_select: '',
  multi_select: '',
  text: 'Type your answer…',
  date: '',
  time: '',
};

const TYPE_INPUT_LABEL: Record<SmartQuestionType, string> = {
  single_select: 'Choose one',
  multi_select: 'Choose one or more',
  text: 'Your answer',
  date: 'Date',
  time: 'Time',
};

/**
 * One Smart Question at a time. Question text and options arrive as plain
 * data from the API and are rendered as text only — never as HTML.
 */
export function SmartQuestionCard({
  question,
  disabled,
  onSubmit,
  onCancel,
}: {
  question: SmartQuestion;
  disabled?: boolean;
  onSubmit: (value: string | string[] | null) => void;
  onCancel: () => void;
}) {
  const isSelect = question.type === 'single_select' || question.type === 'multi_select';
  const [selected, setSelected] = useState<string[]>([]);
  const [other, setOther] = useState('');
  const [text, setText] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');

  const toggle = (value: string) => {
    if (question.type === 'multi_select') {
      setSelected((current) =>
        current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
      );
      return;
    }
    setSelected([value]);
  };

  const canSubmit = (() => {
    if (isSelect) {
      return selected.length > 0 || other.trim().length > 0;
    }
    if (question.type === 'text') return text.trim().length > 0;
    if (question.type === 'date') return date.length > 0;
    if (question.type === 'time') return time.length > 0;
    return false;
  })();

  const submit = () => {
    if (!canSubmit || disabled) return;
    if (isSelect) {
      const otherTrimmed = other.trim();
      if (otherTrimmed && selected.length === 0) {
        onSubmit(otherTrimmed);
        return;
      }
      onSubmit(
        question.type === 'multi_select'
          ? [...selected, ...(otherTrimmed ? [otherTrimmed] : [])]
          : (selected[0] ?? otherTrimmed)
      );
      return;
    }
    if (question.type === 'text') onSubmit(text.trim());
    else if (question.type === 'date') onSubmit(date);
    else onSubmit(time);
  };

  return (
    <section
      aria-label="Smart question"
      className="me-auto max-w-[92%] rounded-lg border border-[#dbe1e8] bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.05)]"
    >
      <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#c2410c]">
        <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
          help
        </span>
        Miad
      </p>
      <p className="text-[13px] leading-5 text-[#343a42]">{question.text}</p>

      {isSelect ? (
        <>
          <div
            role="group"
            aria-label={TYPE_INPUT_LABEL[question.type]}
            className="mt-2.5 flex flex-wrap gap-1.5"
          >
            {question.options.map((option) => {
              const isSelected = selected.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  disabled={disabled}
                  aria-pressed={isSelected}
                  onClick={() => toggle(option.value)}
                  className={`inline-flex min-h-9 items-center rounded-full border px-3 py-1 text-xs transition-colors disabled:opacity-50 ${focusRing} ${
                    isSelected
                      ? 'border-[#9f1239] bg-[#fff1f2] font-medium text-[#9f1239]'
                      : 'border-[#e4e4e7] bg-white text-[#3f3f46] hover:border-[#fda4af]'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          {question.allowOther && (
            <label className="mt-2.5 block">
              <span className="sr-only">Other answer</span>
              <input
                type="text"
                value={other}
                disabled={disabled}
                maxLength={120}
                onChange={(event) => setOther(event.target.value)}
                placeholder="Something else…"
                className={`w-full rounded-md border border-[#cfd4da] bg-white px-2.5 py-2 text-[13px] text-[#20242a] outline-none placeholder:text-[#6b7280] disabled:opacity-50 ${focusRing}`}
              />
            </label>
          )}
        </>
      ) : question.type === 'text' ? (
        <label className="mt-2.5 block">
          <span className="sr-only">{TYPE_INPUT_LABEL.text}</span>
          <textarea
            value={text}
            disabled={disabled}
            rows={2}
            maxLength={200}
            onChange={(event) => setText(event.target.value)}
            placeholder={TYPE_PLACEHOLDER.text}
            className={`w-full resize-none rounded-md border border-[#cfd4da] bg-white px-2.5 py-2 text-[13px] text-[#20242a] outline-none placeholder:text-[#6b7280] disabled:opacity-50 ${focusRing}`}
          />
        </label>
      ) : question.type === 'date' ? (
        <label className="mt-2.5 block">
          <span className="sr-only">{TYPE_INPUT_LABEL.date}</span>
          <input
            type="date"
            value={date}
            disabled={disabled}
            onChange={(event) => setDate(event.target.value)}
            className={`w-full rounded-md border border-[#cfd4da] bg-white px-2.5 py-2 text-[13px] text-[#20242a] outline-none disabled:opacity-50 ${focusRing}`}
          />
        </label>
      ) : (
        <label className="mt-2.5 block">
          <span className="sr-only">{TYPE_INPUT_LABEL.time}</span>
          <input
            type="time"
            value={time}
            disabled={disabled}
            onChange={(event) => setTime(event.target.value)}
            className={`w-full rounded-md border border-[#cfd4da] bg-white px-2.5 py-2 text-[13px] text-[#20242a] outline-none disabled:opacity-50 ${focusRing}`}
          />
        </label>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          disabled={!canSubmit || disabled}
          onClick={submit}
          className={`inline-flex min-h-9 items-center gap-1.5 rounded-md bg-[#9f1239] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#881337] disabled:cursor-not-allowed disabled:opacity-45 ${focusRing}`}
        >
          Continue
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onCancel}
          className={`inline-flex min-h-9 items-center rounded-md px-2 py-1.5 text-xs text-[#6b7280] transition-colors hover:text-[#27272a] disabled:opacity-50 ${focusRing}`}
        >
          Cancel
        </button>
      </div>
    </section>
  );
}
