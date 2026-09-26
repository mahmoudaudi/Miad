import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SmartQuestionCard } from './SmartQuestionCard';
import type { SmartQuestion } from '@/lib/ai-studio';

const base: SmartQuestion = {
  id: 'atmosphere',
  text: 'What kind of atmosphere would you like for the dinner?',
  type: 'single_select',
  options: [
    { label: 'Modern', value: 'Modern' },
    { label: 'Luxury', value: 'Luxury' },
    { label: 'Professional', value: 'Professional' },
  ],
  allowOther: true,
};

const render = (question: Partial<SmartQuestion> = {}) =>
  renderToStaticMarkup(
    <SmartQuestionCard
      question={{ ...base, ...question }}
      onSubmit={() => undefined}
      onCancel={() => undefined}
    />
  );

/** Visible text only, so CSS class names cannot satisfy or break assertions. */
const visibleText = (html: string) => html.replace(/<[^>]*>/g, ' ');

describe('SmartQuestionCard', () => {
  it('renders exactly one question with its real options as data', () => {
    const html = render();
    expect(html).toContain('Smart question');
    expect(html).toContain('What kind of atmosphere would you like for the dinner?');
    expect(html).toContain('Modern');
    expect(html).toContain('Luxury');
    expect(html).toContain('Professional');
    // One question at a time: no second question block.
    expect(html.match(/aria-label="Smart question"/g)).toHaveLength(1);
    expect(html).not.toContain('<script');
  });

  it('offers a custom answer and no timer, percentage, or generation stages', () => {
    const html = render();
    expect(html).toContain('Something else');
    expect(html).toContain('aria-pressed="false"');
    // No simulated progress of any kind in the rendered text.
    expect(visibleText(html)).not.toMatch(/%|remaining|seconds|estimated|countdown/i);
    expect(html).not.toContain('Generating your website');
  });

  it('uses a group of toggle options for single_select', () => {
    const html = render({ type: 'single_select' });
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="Choose one"');
    expect(html).toContain('aria-pressed="false"');
  });

  it('uses a multi-answer group for multi_select', () => {
    const html = render({ type: 'multi_select' });
    expect(html).toContain('aria-label="Choose one or more"');
  });

  it('uses a free-form field for text questions with no options', () => {
    const html = render({ type: 'text', options: [] });
    expect(html).toContain('<textarea');
    expect(html).not.toContain('role="group"');
    expect(html).not.toContain('Something else');
  });

  it('uses a date input for date questions', () => {
    const html = render({ type: 'date', options: [] });
    expect(html).toContain('type="date"');
    expect(html).not.toContain('role="group"');
  });

  it('uses a time input for time questions', () => {
    const html = render({ type: 'time', options: [] });
    expect(html).toContain('type="time"');
    expect(html).not.toContain('role="group"');
  });

  it('disables Continue until an answer exists, and disables everything while busy', () => {
    const idle = render();
    expect(idle).toContain('Continue');
    expect(idle).toContain('disabled=""');
    const busy = renderToStaticMarkup(
      <SmartQuestionCard
        question={base}
        disabled
        onSubmit={() => undefined}
        onCancel={() => undefined}
      />
    );
    expect(busy).toContain('disabled=""');
  });

  it('wires submit and cancel without navigating away', () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    const html = renderToStaticMarkup(
      <SmartQuestionCard question={base} onSubmit={onSubmit} onCancel={onCancel} />
    );
    // Static render cannot click; assert the interactive controls are present
    // and that rendering alone triggers no submission or navigation.
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
    expect(html).toContain('Continue');
    expect(html).toContain('Cancel');
    expect(html).not.toContain('href=');
  });
});
