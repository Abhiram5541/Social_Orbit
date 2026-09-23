import type { Metadata } from "next";
import { MarketingChrome } from "@/components/shell/marketing-chrome";
import { ApplyStart } from "@/components/onboarding/apply-start";

export const metadata: Metadata = { title: "Apply as a creator", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Where a creator starts an application. No account needed. */
export default async function ApplyPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const { org } = await searchParams;
  return (
    <MarketingChrome>
      <div className="mx-auto max-w-lg px-4 py-14 sm:px-6">
        <div className="space-y-1">
          <h1 className="text-title font-semibold tracking-display text-ink">
            Apply to join SENSO
          </h1>
          <p className="text-base text-ink-muted">
            Tell us who you are and where you publish. Your figures are read from the
            platforms themselves, so nothing you enter here is published as a measurement —
            what you write helps us find and verify the right accounts.
          </p>
        </div>
        <div className="mt-6">
          <ApplyStart orgId={org ?? null} />
        </div>
      </div>
    </MarketingChrome>
  );
}
