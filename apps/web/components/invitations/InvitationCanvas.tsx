import React, { type ElementType } from 'react';
import {
  completeInvitationSpecification,
  heroVariantOf,
  type InvitationDesignSpecification,
} from '@/lib/invitation-designs';

export function InvitationCanvas({
  specification,
  titleAs = 'h3',
  className = '',
  publicPresentation = false,
  selectedElementId,
  onSelectElement,
}: {
  specification: InvitationDesignSpecification;
  titleAs?: 'h1' | 'h3';
  className?: string;
  /** Render the saved invitation as the public page itself, without the editor preview frame. */
  publicPresentation?: boolean;
  selectedElementId?: string | null;
  onSelectElement?: (id: string) => void;
}) {
  const { colors, content, typography, layout, sections, elements } =
    completeInvitationSpecification(specification);
  const Title = titleAs as ElementType;
  const heroVariant = heroVariantOf(
    sections.find((section) => section.type === 'hero' && section.visible)?.variant
  );
  const displayUrl = (url: string | undefined): string | null =>
    url && !/^(?:image|media):\/\//.test(url) ? url : null;
  const heroImageUrl =
    elements
      .map((element) =>
        element.type === 'image' ? displayUrl(element.imageUrl) : null
      )
      .find((url): url is string => Boolean(url)) ?? null;
  const centeredText = layout.alignment === 'center';
  const header = (compact = false) => (
    <>
      <p
        className="break-words text-xs uppercase tracking-[0.2em]"
        style={{ color: colors.accent }}
      >
        {content.eyebrow}
      </p>
      <Title
        className={`break-words leading-tight ${
          compact ? 'mt-4 text-3xl sm:text-4xl' : 'mt-8 text-4xl sm:mt-12 sm:text-5xl'
        }`}
        style={{ fontFamily: typography.headingFamily }}
      >
        {content.title}
      </Title>
      <div
        aria-hidden="true"
        className={`mt-7 h-px w-14 ${centeredText ? 'mx-auto' : ''}`}
        style={{ backgroundColor: colors.accent }}
      />
      <p className="mt-7 break-words text-sm">{content.dateLine}</p>
      <p className="mt-3 break-words text-sm" style={{ color: colors.accent }}>
        {content.venueLine}
      </p>
    </>
  );
  return (
    <article
      className={`relative flex flex-col justify-center ${
        publicPresentation
          ? 'min-h-[100svh] w-full overflow-visible px-5 sm:px-10'
          : 'min-h-[380px] overflow-hidden rounded-xl border px-5 sm:min-h-[480px]'
      } ${layout.density === 'airy' ? 'py-12 sm:py-24' : 'py-9 sm:py-14'} ${className}`}
      style={{
        backgroundColor: colors.surface,
        ...(publicPresentation ? {} : { borderColor: colors.accent }),
        color: colors.text,
        textAlign: layout.alignment,
        fontFamily: typography.bodyFamily,
      }}
    >
      {heroVariant === 'overlay' && heroImageUrl ? (
        <div className="relative z-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={heroImageUrl}
            alt=""
            onError={(event) => {
              event.currentTarget.style.display = 'none';
            }}
            className="h-56 w-full rounded-xl object-cover sm:h-72"
          />
          <div
            className="relative z-10 mx-2 -mt-12 rounded-xl border px-5 py-8 sm:mx-6"
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.accent,
              textAlign: layout.alignment,
            }}
          >
            {header(true)}
          </div>
        </div>
      ) : heroVariant === 'split' ? (
        <div className="relative z-10 grid items-center gap-6 sm:grid-cols-2">
          <div style={{ textAlign: layout.alignment }}>{header(true)}</div>
          {heroImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={heroImageUrl}
              alt=""
              onError={(event) => {
                event.currentTarget.style.display = 'none';
              }}
              className="h-56 w-full rounded-xl object-cover sm:h-full sm:min-h-72"
            />
          ) : (
            <div
              aria-hidden="true"
              className="hidden h-56 rounded-xl sm:block sm:h-full sm:min-h-72"
              style={{ backgroundColor: `${colors.accent}26` }}
            />
          )}
        </div>
      ) : heroVariant === 'minimal' ? (
        <div className="relative z-10" style={{ textAlign: layout.alignment }}>
          {header(true)}
        </div>
      ) : (
        <div className="relative z-10" style={{ textAlign: layout.alignment }}>
          {header()}
        </div>
      )}
      {elements.length > 0 && (
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden={onSelectElement ? undefined : true}
        >
          {elements.map((element) => {
            const selected = selectedElementId === element.id;
            const imageSrc = element.type === 'image' ? displayUrl(element.imageUrl) : null;
            const body =
              element.type === 'image' ? (
                imageSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imageSrc}
                    alt=""
                    onError={(event) => {
                      event.currentTarget.style.display = 'none';
                    }}
                    className="h-full min-h-24 w-full rounded object-cover"
                  />
                ) : (
                  <span className="flex min-h-24 items-center justify-center rounded border border-dashed border-current text-xs opacity-70">
                    Image
                  </span>
                )
              ) : (
                (element.text ?? element.label)
              );
            const commonStyle: React.CSSProperties = {
              left: `${element.x}%`,
              top: `${element.y}%`,
              width: `${element.width}%`,
              minHeight: `${element.height}%`,
              color: element.color,
              fontSize: element.fontSize,
              fontFamily: element.id === 'title' ? typography.headingFamily : typography.bodyFamily,
              borderColor: selected ? colors.accent : 'transparent',
              backgroundColor: element.backgroundColor,
            };
            return onSelectElement ? (
              <button
                key={element.id}
                type="button"
                tabIndex={0}
                onClick={() => onSelectElement?.(element.id)}
                className="pointer-events-auto absolute whitespace-pre-wrap rounded-md border p-1 text-start leading-tight cursor-pointer hover:border-current"
                style={commonStyle}
              >
                {body}
              </button>
            ) : (
              <div
                key={element.id}
                className="absolute whitespace-pre-wrap rounded-md border p-1 text-start leading-tight"
                style={commonStyle}
              >
                {body}
              </div>
            );
          })}
        </div>
      )}
      {sections.some((section) => section.visible && section.type !== 'hero') && (
        <div className="relative z-10 mt-10 grid gap-3 text-start sm:grid-cols-2">
          {sections
            .filter((section) => section.visible && section.type !== 'hero')
            .sort((left, right) => left.order - right.order)
            .slice(0, 4)
            .map((section) => (
              <section
                key={section.id}
                className="rounded-lg border px-4 py-3"
                style={{
                  borderColor: `${colors.accent}55`,
                  backgroundColor: `${colors.background}CC`,
                }}
              >
                <h4 className="text-sm font-semibold" style={{ color: colors.accent }}>
                  {section.title}
                </h4>
                <p className="mt-1 text-xs leading-relaxed">{section.body}</p>
              </section>
            ))}
        </div>
      )}
    </article>
  );
}
