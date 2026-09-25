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
      className="min-h-screen overflow-x-hidden p-3 sm:p-6 lg:p-10"
      style={specification ? { backgroundColor: specification.colors.background } : undefined}
    >
      <div className="mx-auto max-w-5xl">
        {artifact ? (
          <HtmlInvitationFrame
            src={`/api/public/invitations/${encodeURIComponent(slug)}/render`}
            title={artifact.title}
            className="min-h-[calc(100svh-1.5rem)] w-full sm:min-h-[calc(100svh-3rem)] lg:min-h-[calc(100svh-5rem)]"
          />
        ) : specification ? (
          <InvitationCanvas
            specification={specification}
            titleAs="h1"
            className="min-h-[calc(100svh-1.5rem)] sm:min-h-[calc(100svh-3rem)] lg:min-h-[calc(100svh-5rem)]"
          />
        ) : null}
        <div className="mx-auto mt-6 max-w-2xl sm:mt-10">
          <PublicRsvpForm slug={slug} />
        </div>
      </div>
    </main>
  );
}
