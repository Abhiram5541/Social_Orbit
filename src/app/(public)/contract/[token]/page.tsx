import type { Metadata } from "next";
import { contractByToken } from "@/server/services/deal-service";
import { MarketingChrome } from "@/components/shell/marketing-chrome";
import { ContractSigner } from "@/components/campaign/contract-signer";

export const metadata: Metadata = { title: "Agreement", robots: { index: false } };
export const dynamic = "force-dynamic";

/** The signer's view: a creator with no SENSO account, reached by a link. */
export default async function ContractPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const contract = contractByToken(token);

  return (
    <MarketingChrome>
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        {contract === null ? (
          <div className="space-y-2">
            <h1 className="text-title font-semibold tracking-display text-ink">
              This link is not valid
            </h1>
            <p className="text-base text-ink-muted">
              Ask whoever sent the agreement for a new link.
            </p>
          </div>
        ) : (
          <ContractSigner token={token} initial={contract} />
        )}
      </div>
    </MarketingChrome>
  );
}
