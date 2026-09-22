import type { Metadata } from "next";
import { proposalByToken } from "@/server/services/campaign-workflow-service";
import { MarketingChrome } from "@/components/shell/marketing-chrome";
import { ProposalReview } from "@/components/campaign/proposal-review";

export const metadata: Metadata = { title: "Campaign proposal", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * The client-facing roster approval. No session: the recipient is a brand
 * contact reached by an unguessable link, and the link grants this proposal
 * alone.
 */
export default async function ProposalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const proposal = proposalByToken(token);

  return (
    <MarketingChrome>
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        {proposal === null ? (
          <div className="space-y-2">
            <h1 className="text-title font-semibold tracking-display text-ink">
              This link is not valid
            </h1>
            <p className="text-base text-ink-muted">
              A proposal link expires on the date its sender set, and each one opens a
              single campaign. Ask whoever sent it for a new link.
            </p>
          </div>
        ) : (
          <ProposalReview token={token} initial={proposal} />
        )}
      </div>
    </MarketingChrome>
  );
}
