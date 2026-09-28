import React from 'react';
import type { HtmlDesignArtifact, InvitationDesignSpecification } from '@/lib/invitation-designs';
import { HtmlInvitationFrame } from './HtmlInvitationFrame';
import { InvitationCanvas } from './InvitationCanvas';
import { PublicRsvpForm } from './PublicRsvpForm';

type PublicInvitationViewProps =
  | {
      slug: string;
      specification: InvitationDesignSpecification;
      artifact?: never;
    }
  | {
      slug: string;
      artifact: Pick<HtmlDesignArtifact, 'format' | 'version' | 'title' | 'description'>;
      specification?: never;
    };

export function PublicInvitationView(props: PublicInvitationViewProps) {
  const { slug } = props;
  const artifact = 'artifact' in props ? props.artifact : undefined;
  const specification = artifact ? undefined : props.specification;

  return (
    <main
      className="min-h-[100svh] w-full overflow-x-clip"
      style={specification ? { backgroundColor: specification.colors.background } : undefined}
    >
      {artifact ? (
        <HtmlInvitationFrame
          fullPage
          src={`/api/public/invitations/${encodeURIComponent(slug)}/render`}
          title={artifact.title}
          className="h-[100svh] min-h-[100svh] w-full"
        />
      ) : specification ? (
        <InvitationCanvas
          specification={specification}
          titleAs="h1"
          publicPresentation
          className="w-full"
        />
      ) : null}
      {/* The SaaS-owned RSVP stays outside the AI-rendered canvas/iframe. */}
      <section className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
        <PublicRsvpForm slug={slug} />
      </section>
    </main>
  );
}
