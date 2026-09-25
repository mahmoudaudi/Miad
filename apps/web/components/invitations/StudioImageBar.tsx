import React from 'react';

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2';

/**
 * Photo source bar for the AI studio: upload your own photo (signed media
 * flow) or paste an internet image link. Which source fits depends on the
 * invitation — the hint is contextual per event type.
 */
export function StudioImageBar({
  disabled,
  uploading,
  progress,
  imageUrl,
  notice,
  hint,
  onFile,
  onUrlChange,
  onUrlAdd,
}: {
  disabled: boolean;
  uploading: boolean;
  progress: number | null;
  imageUrl: string;
  notice: string | null;
  hint: string;
  onFile: (file: File) => void;
  onUrlChange: (value: string) => void;
  onUrlAdd: () => void;
}) {
  return (
    <section
      aria-label="Invitation photos"
      className="mt-5 rounded-2xl border border-line bg-surface p-4 shadow-subtle sm:p-5"
    >
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-lg text-primary" aria-hidden="true">
          image
        </span>
        <h2 className="font-medium text-ink">Photos</h2>
      </div>
      <p className="mt-1 text-body-sm text-muted">{hint}</p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label
          className={`focus-within:outline focus-within:outline-2 focus-within:outline-primary focus-within:outline-offset-2 inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-line px-4 text-body-md font-medium text-ink transition-colors hover:border-muted/50 ${
            disabled || uploading ? 'pointer-events-none opacity-50' : ''
          } ${focusRing}`}
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
            upload
          </span>
          {uploading ? 'Uploading…' : 'Upload photo'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={disabled || uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) onFile(file);
            }}
            className="sr-only"
          />
        </label>
        <form
          className="flex min-w-0 flex-1 gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            onUrlAdd();
          }}
        >
          <label htmlFor="studio-image-url" className="sr-only">
            Paste an internet image link
          </label>
          <input
            id="studio-image-url"
            type="url"
            inputMode="url"
            value={imageUrl}
            onChange={(event) => onUrlChange(event.target.value)}
            disabled={disabled || uploading}
            placeholder="https://… image link"
            className={`min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-background px-4 text-body-md text-ink placeholder:text-muted disabled:opacity-50 ${focusRing}`}
          />
          <button
            type="submit"
            disabled={disabled || uploading || imageUrl.trim().length === 0}
            className={`inline-flex min-h-11 items-center justify-center rounded-xl bg-ink px-4 text-body-md font-semibold text-white transition-colors hover:bg-primary disabled:opacity-50 ${focusRing}`}
          >
            Add
          </button>
        </form>
      </div>
      {uploading && progress !== null && (
        <div
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink/10"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Upload progress"
        >
          <div
            className="h-full origin-left rounded-full bg-primary transition-transform"
            style={{ transform: `scaleX(${progress / 100})` }}
          />
        </div>
      )}
      {notice && (
        <p role="status" className="mt-3 text-body-sm text-muted">
          {notice}
        </p>
      )}
    </section>
  );
}
