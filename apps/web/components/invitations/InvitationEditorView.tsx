import Link from 'next/link';
import React, { memo } from 'react';
import {
  applyInvitationTheme,
  completeInvitationSpecification,
  invitationDesignOptions,
  InvitationDesignRecord,
  InvitationElement,
  InvitationDesignSpecification,
  InvitationSection,
  InvitationThemeId,
} from '@/lib/invitation-designs';
import { InvitationCanvas } from './InvitationCanvas';

export type InvitationEditorState =
  | { status: 'loading' }
  | { status: 'not-found' }
  | { status: 'missing-design' }
  | { status: 'error'; message: string }
  | { status: 'ready'; design: InvitationDesignRecord };

type Props = {
  invitationId: string;
  state: InvitationEditorState;
  draft: InvitationDesignSpecification | null;
  dirty: boolean;
  saving: boolean;
  saveError: string | null;
  successMessage: string | null;
  aiPrompt?: string;
  aiBusy?: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
  onAiPromptChange?: (value: string) => void;
  onAiRegenerate?: () => void;
  onAiRefine?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onChange: (next: InvitationDesignSpecification) => void;
  onSave: () => void;
  onRetry: () => void;
};

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2';
const inputClass = 'miad-input mt-2';

export const InvitationPreview = memo(function InvitationPreview({
  specification,
  selectedElementId,
  onSelectElement,
  zoom = 1,
  viewport = 'desktop',
}: {
  specification: InvitationDesignSpecification;
  selectedElementId?: string | null;
  onSelectElement?: (id: string) => void;
  zoom?: number;
  viewport?: 'desktop' | 'mobile';
}) {
  const widthClass = viewport === 'mobile' ? 'max-w-[390px]' : 'max-w-[760px]';
  return (
    <section aria-labelledby="live-preview-heading">
      <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <h2 id="live-preview-heading" className="font-display text-headline-sm text-ink">
          Live preview
        </h2>
        <span className="text-label-sm uppercase tracking-wider text-muted">Updates instantly</span>
      </div>
      <div
        className="mt-4 overflow-auto rounded-2xl border border-line p-3 shadow-subtle sm:p-5"
        style={{ backgroundColor: specification.colors.background }}
      >
        <div className={`mx-auto origin-top ${widthClass}`} style={{ transform: `scale(${zoom})` }}>
          <InvitationCanvas
            specification={specification}
            selectedElementId={selectedElementId}
            onSelectElement={onSelectElement}
          />
        </div>
      </div>
    </section>
  );
});

function StatePage({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
      <section className="rounded-2xl border border-line bg-surface p-8 shadow-subtle sm:p-12">
        <h1 className="font-display text-headline-md text-ink">{title}</h1>
        <p className="mt-3 text-body-md text-muted">{message}</p>
        <div className="mt-7">{action}</div>
      </section>
    </main>
  );
}

export function InvitationEditorView({
  invitationId,
  state,
  draft,
  dirty,
  saving,
  saveError,
  successMessage,
  aiPrompt = '',
  aiBusy = false,
  canUndo = false,
  canRedo = false,
  onAiPromptChange = () => undefined,
  onAiRegenerate = () => undefined,
  onAiRefine = () => undefined,
  onUndo = () => undefined,
  onRedo = () => undefined,
  onChange,
  onSave,
  onRetry,
}: Props) {
  const [selectedElementId, setSelectedElementId] = React.useState<string | null>('title');
  const [zoom, setZoom] = React.useState(1);
  const [viewport, setViewport] = React.useState<'desktop' | 'mobile'>('desktop');
  const [mobilePanel, setMobilePanel] = React.useState<'edit' | 'preview'>('edit');
  if (state.status === 'loading') {
    return (
      <main
        aria-busy="true"
        aria-label="Loading invitation editor"
        className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8"
      >
        <div className="h-[680px] animate-pulse rounded-2xl border border-line bg-surface" />
      </main>
    );
  }
  if (state.status === 'not-found') {
    return (
      <StatePage
        title="Invitation not found"
        message="This invitation is unavailable or may have been removed."
        action={
          <Link
            href="/dashboard/events"
            className={`inline-flex rounded-xl bg-primary px-5 py-3 text-label-md text-white ${focusRing}`}
          >
            Back to Events
          </Link>
        }
      />
    );
  }
  if (state.status === 'missing-design') {
    return (
      <StatePage
        title="Choose a design first"
        message="Select and save a design before opening the editor."
        action={
          <Link
            href={`/dashboard/invitations/${invitationId}/design`}
            className={`inline-flex rounded-xl bg-primary px-5 py-3 text-label-md text-white ${focusRing}`}
          >
            Choose a design
          </Link>
        }
      />
    );
  }
  if (state.status === 'error') {
    return (
      <StatePage
        title="Editor unavailable"
        message={state.message}
        action={
          <button
            type="button"
            onClick={onRetry}
            className={`rounded-xl border border-line px-5 py-3 text-label-md text-ink ${focusRing}`}
          >
            Try again
          </button>
        }
      />
    );
  }
  if (!draft) return null;
  const completeDraft = completeInvitationSpecification(draft);
  const selectedElement =
    completeDraft.elements.find((element) => element.id === selectedElementId) ??
    completeDraft.elements[0] ??
    null;

  const update = <K extends keyof InvitationDesignSpecification>(
    key: K,
    value: InvitationDesignSpecification[K]
  ) => onChange({ ...completeDraft, [key]: value });
  const updateElement = (id: string, patch: Partial<InvitationElement>) =>
    update(
      'elements',
      completeDraft.elements.map((element) =>
        element.id === id ? { ...element, ...patch } : element
      )
    );
  const updateSection = (id: string, patch: Partial<InvitationSection>) =>
    update(
      'sections',
      completeDraft.sections.map((section) =>
        section.id === id ? { ...section, ...patch } : section
      )
    );
  const moveSection = (id: string, direction: -1 | 1) => {
    const ordered = [...completeDraft.sections].sort((left, right) => left.order - right.order);
    const index = ordered.findIndex((section) => section.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ordered.length) return;
    const current = ordered[index];
    const next = ordered[target];
    if (!current || !next) return;
    ordered[index] = next;
    ordered[target] = current;
    update(
      'sections',
      ordered.map((section, order) => ({ ...section, order }))
    );
  };

  return (
    <main className="mx-auto max-w-[1400px] px-4 pt-8 pb-32 sm:px-6 sm:pt-10 lg:px-8 xl:pb-10">
      <header className="flex flex-col gap-5 border-b border-line pb-6 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <Link
            href={`/dashboard/invitations/${invitationId}/design`}
            className={`rounded-lg text-label-md text-muted hover:text-ink ${focusRing}`}
          >
            ← Back to Design
          </Link>
          <p className="mt-6 text-label-sm uppercase tracking-[0.16em] text-accent">
            Invitation editor
          </p>
          <h1 className="mt-2 font-display text-headline-lg-mobile text-ink sm:text-headline-lg">
            Shape the invitation
          </h1>
        </div>
        <div className="miad-editor-toolbar flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-3 xl:w-auto">
          <span
            aria-live="polite"
            className={`w-full text-label-sm xl:w-auto ${dirty ? 'text-warning' : 'text-muted'}`}
          >
            {dirty ? 'Unsaved changes' : 'All changes saved'}
          </span>
          <button
            type="button"
            onClick={onSave}
            disabled={!dirty || saving || aiBusy}
            className={`flex-1 rounded-xl bg-primary px-5 py-3 text-label-md text-white disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto ${focusRing}`}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo || saving || aiBusy}
            title="Undo"
            aria-label="Undo"
            className={`rounded-xl border border-line px-4 py-3 text-label-md text-ink disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`}
          >
            ↶
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo || saving || aiBusy}
            title="Redo"
            aria-label="Redo"
            className={`rounded-xl border border-line px-4 py-3 text-label-md text-ink disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`}
          >
            ↷
          </button>
        </div>
      </header>

      {(saveError || successMessage) && (
        <div className="mt-5" aria-live="polite">
          {saveError && (
            <p role="alert" className="text-body-sm text-error">
              {saveError}
            </p>
          )}
          {successMessage && <p className="text-body-sm text-success">{successMessage}</p>}
        </div>
      )}

      <div
        className="sticky top-16 z-10 mt-5 flex gap-1 rounded-xl border border-line bg-surface p-1 lg:top-0 xl:hidden"
        aria-label="Editor view"
      >
        {(['edit', 'preview'] as const).map((panel) => (
          <button
            key={panel}
            type="button"
            aria-pressed={mobilePanel === panel}
            aria-controls={panel === 'edit' ? 'editor-controls-panel' : 'editor-preview-panel'}
            onClick={() => setMobilePanel(panel)}
            className={`miad-button flex-1 ${mobilePanel === panel ? 'bg-secondary text-primary' : 'text-muted'}`}
          >
            {panel === 'edit' ? 'Edit invitation' : 'Preview invitation'}
          </button>
        ))}
      </div>
      <div className="mt-5 grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <section
          id="editor-controls-panel"
          aria-labelledby="editor-controls-heading"
          className={`${mobilePanel === 'edit' ? 'block' : 'hidden'} min-w-0 rounded-2xl border border-line bg-surface p-4 sm:p-5 xl:block xl:max-h-[calc(100dvh-7rem)] xl:overflow-y-auto`}
        >
          <h2 id="editor-controls-heading" className="font-display text-headline-sm text-ink">
            Editor controls
          </h2>

          <div className="mt-5 divide-y divide-line">
            <details className="miad-editor-group py-4" open>
              <summary className="cursor-pointer text-sm font-medium text-ink">AI</summary>
              <fieldset className="mt-4" disabled={aiBusy}>
                <legend className="sr-only">AI</legend>
                <label className="mt-3 block text-label-md text-ink">
                  Instruction
                  <textarea
                    value={aiPrompt}
                    maxLength={1000}
                    rows={3}
                    onChange={(event) => onAiPromptChange(event.target.value)}
                    className={inputClass}
                    placeholder="Make it warmer, add a garden note, use bolder contrast..."
                  />
                </label>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={onAiRefine}
                    disabled={aiBusy || saving || !aiPrompt.trim()}
                    className={`rounded-xl border border-line px-3 py-2.5 text-label-md text-ink disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`}
                  >
                    {aiBusy ? 'Working…' : 'Refine'}
                  </button>
                  <button
                    type="button"
                    onClick={onAiRegenerate}
                    disabled={aiBusy || saving || !aiPrompt.trim()}
                    className={`rounded-xl bg-primary px-3 py-2.5 text-label-md text-white disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`}
                  >
                    Regenerate
                  </button>
                </div>
              </fieldset>
            </details>

            <details className="miad-editor-group py-4" open>
              <summary className="cursor-pointer text-sm font-medium text-ink">Text</summary>
              <fieldset className="mt-4" disabled={aiBusy}>
                <legend className="sr-only">Text</legend>
                <div className="mt-3 space-y-4">
                  {(
                    [
                      ['eyebrow', 'Eyebrow', 80],
                      ['title', 'Title', 120],
                      ['dateLine', 'Date line', 100],
                      ['venueLine', 'Venue line', 160],
                    ] as const
                  ).map(([key, label, maxLength]) => (
                    <label key={key} className="block text-label-md text-ink">
                      {label}
                      <input
                        id={`editor-${key}`}
                        value={completeDraft.content[key]}
                        maxLength={maxLength}
                        onChange={(event) =>
                          update('content', { ...completeDraft.content, [key]: event.target.value })
                        }
                        className={inputClass}
                      />
                    </label>
                  ))}
                </div>
              </fieldset>
            </details>

            <details className="miad-editor-group py-4">
              <summary className="cursor-pointer text-sm font-medium text-ink">Theme</summary>
              <fieldset className="mt-4" disabled={aiBusy}>
                <legend className="sr-only">Theme</legend>
                <label className="mt-3 block text-label-md text-ink">
                  Base theme
                  <select
                    id="editor-theme"
                    value={completeDraft.theme}
                    onChange={(event) =>
                      onChange(
                        applyInvitationTheme(completeDraft, event.target.value as InvitationThemeId)
                      )
                    }
                    className={inputClass}
                  >
                    {invitationDesignOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </label>
              </fieldset>
            </details>

            <details className="miad-editor-group py-4">
              <summary className="cursor-pointer text-sm font-medium text-ink">Colors</summary>
              <fieldset className="mt-4" disabled={aiBusy}>
                <legend className="sr-only">Colors</legend>
                <div className="mt-3 grid grid-cols-2 gap-4">
                  {(
                    [
                      ['background', 'Background'],
                      ['surface', 'Surface'],
                      ['text', 'Text'],
                      ['accent', 'Accent'],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="text-label-md text-ink">
                      {label}
                      <span className="mt-2 flex items-center gap-2 rounded-xl border border-line px-2.5 py-2">
                        <input
                          id={`editor-color-${key}`}
                          type="color"
                          value={completeDraft.colors[key]}
                          onChange={(event) =>
                            update('colors', {
                              ...completeDraft.colors,
                              [key]: event.target.value.toUpperCase(),
                            })
                          }
                          className={`size-9 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0 ${focusRing}`}
                        />
                        <span className="min-w-0 truncate font-mono text-xs text-muted">
                          {completeDraft.colors[key]}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </details>

            <details className="miad-editor-group py-4">
              <summary className="cursor-pointer text-sm font-medium text-ink">Typography</summary>
              <fieldset className="mt-4" disabled={aiBusy}>
                <legend className="sr-only">Typography</legend>
                <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                  {(
                    [
                      ['headingFamily', 'Heading font'],
                      ['bodyFamily', 'Body font'],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="block text-label-md text-ink">
                      {label}
                      <select
                        id={`editor-${key}`}
                        value={completeDraft.typography[key]}
                        onChange={(event) =>
                          update('typography', {
                            ...completeDraft.typography,
                            [key]: event.target.value as 'Playfair Display' | 'Inter',
                          })
                        }
                        className={inputClass}
                      >
                        <option value="Playfair Display">Playfair Display</option>
                        <option value="Inter">Inter</option>
                      </select>
                    </label>
                  ))}
                </div>
              </fieldset>
            </details>

            <details className="miad-editor-group py-4">
              <summary className="cursor-pointer text-sm font-medium text-ink">Layout</summary>
              <fieldset className="mt-4" disabled={aiBusy}>
                <legend className="sr-only">Layout</legend>
                <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                  <label className="block text-label-md text-ink">
                    Alignment
                    <select
                      id="editor-alignment"
                      value={completeDraft.layout.alignment}
                      onChange={(event) =>
                        update('layout', {
                          ...completeDraft.layout,
                          alignment: event.target.value as 'center' | 'left',
                        })
                      }
                      className={inputClass}
                    >
                      <option value="center">Centered</option>
                      <option value="left">Left aligned</option>
                    </select>
                  </label>
                  <label className="block text-label-md text-ink">
                    Spacing
                    <select
                      id="editor-density"
                      value={completeDraft.layout.density}
                      onChange={(event) =>
                        update('layout', {
                          ...completeDraft.layout,
                          density: event.target.value as 'airy' | 'compact',
                        })
                      }
                      className={inputClass}
                    >
                      <option value="airy">Airy</option>
                      <option value="compact">Compact</option>
                    </select>
                  </label>
                </div>
              </fieldset>
            </details>

            <details className="miad-editor-group py-4">
              <summary className="cursor-pointer text-sm font-medium text-ink">Elements</summary>
              <fieldset className="mt-4" disabled={aiBusy}>
                <legend className="sr-only">Elements</legend>
                <label className="mt-3 block text-label-md text-ink">
                  Selected
                  <select
                    value={selectedElement?.id ?? ''}
                    onChange={(event) => setSelectedElementId(event.target.value)}
                    className={inputClass}
                  >
                    {completeDraft.elements.map((element) => (
                      <option key={element.id} value={element.id}>
                        {element.label}
                      </option>
                    ))}
                  </select>
                </label>
                {selectedElement && (
                  <div className="mt-4 space-y-4">
                    {selectedElement.type !== 'image' && (
                      <label className="block text-label-md text-ink">
                        Text
                        <textarea
                          value={selectedElement.text ?? ''}
                          rows={3}
                          maxLength={300}
                          onChange={(event) =>
                            updateElement(selectedElement.id, { text: event.target.value })
                          }
                          className={inputClass}
                        />
                      </label>
                    )}
                    {selectedElement.type === 'image' && (
                      <label className="block text-label-md text-ink">
                        Image URL
                        <input
                          value={selectedElement.imageUrl ?? ''}
                          onChange={(event) =>
                            updateElement(selectedElement.id, {
                              imageUrl: event.target.value || undefined,
                            })
                          }
                          className={inputClass}
                        />
                      </label>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      {(['x', 'y', 'width', 'height', 'fontSize'] as const).map((key) => (
                        <label key={key} className="block text-label-md text-ink">
                          {key === 'fontSize' ? 'Font' : key.toUpperCase()}
                          <input
                            type="number"
                            min={
                              key === 'fontSize' ? 10 : key === 'width' || key === 'height' ? 4 : 0
                            }
                            max={key === 'fontSize' ? 96 : 100}
                            value={selectedElement[key]}
                            onChange={(event) =>
                              updateElement(selectedElement.id, {
                                [key]: Number(event.target.value),
                              })
                            }
                            className={inputClass}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </fieldset>
            </details>

            <details className="miad-editor-group py-4">
              <summary className="cursor-pointer text-sm font-medium text-ink">Sections</summary>
              <fieldset className="mt-4" disabled={aiBusy}>
                <legend className="sr-only">Sections</legend>
                <div className="mt-3 space-y-3">
                  {[...completeDraft.sections]
                    .sort((left, right) => left.order - right.order)
                    .map((section) => (
                      <div key={section.id} className="rounded-xl border border-line p-3">
                        <div className="flex items-center justify-between gap-2">
                          <label className="flex items-center gap-2 text-label-md text-ink">
                            <input
                              type="checkbox"
                              checked={section.visible}
                              onChange={(event) =>
                                updateSection(section.id, { visible: event.target.checked })
                              }
                            />
                            {section.title}
                          </label>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => moveSection(section.id, -1)}
                              className={`rounded-lg border border-line px-2 py-1 ${focusRing}`}
                              aria-label={`Move ${section.title} up`}
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              onClick={() => moveSection(section.id, 1)}
                              className={`rounded-lg border border-line px-2 py-1 ${focusRing}`}
                              aria-label={`Move ${section.title} down`}
                            >
                              ↓
                            </button>
                          </div>
                        </div>
                        <textarea
                          aria-label={`${section.title} content`}
                          value={section.body}
                          rows={2}
                          maxLength={500}
                          onChange={(event) =>
                            updateSection(section.id, { body: event.target.value })
                          }
                          className={inputClass}
                        />
                      </div>
                    ))}
                </div>
              </fieldset>
            </details>
          </div>
        </section>

        <div
          id="editor-preview-panel"
          className={`${mobilePanel === 'preview' ? 'block' : 'hidden'} min-w-0 xl:sticky xl:top-6 xl:block`}
        >
          <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setViewport(viewport === 'desktop' ? 'mobile' : 'desktop')}
              className={`rounded-lg border border-line px-3 py-2 text-label-md text-ink ${focusRing}`}
            >
              {viewport === 'desktop' ? 'Mobile preview' : 'Desktop preview'}
            </button>
            <label className="flex items-center gap-2 text-label-md text-muted">
              Zoom
              <input
                type="range"
                min="0.7"
                max="1"
                step="0.05"
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
              />
            </label>
          </div>
          <InvitationPreview
            specification={completeDraft}
            selectedElementId={selectedElement?.id ?? null}
            onSelectElement={setSelectedElementId}
            zoom={zoom}
            viewport={viewport}
          />
        </div>
      </div>
    </main>
  );
}
