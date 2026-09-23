import type { Metadata } from "next";
import { applicationByToken } from "@/server/services/onboarding-service";
import { MarketingChrome } from "@/components/shell/marketing-chrome";
import { ApplyForm } from "@/components/onboarding/apply-form";

export const metadata: Metadata = { title: "Your application", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ApplyFormPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const application = applicationByToken(token);

  return (
    <MarketingChrome>
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        {application === null ? (
          <div className="space-y-2">
            <h1 className="text-title font-semibold tracking-display text-ink">
              This application link is not valid
            </h1>
            <p className="text-base text-ink-muted">
              Start again from the application page, or ask whoever invited you for a new
              link.
            </p>
          </div>
        ) : (
          (() => {
            const { token: _t, payout, ...rest } = application;
            void _t;
            return <ApplyForm token={token} initial={{ ...rest, payout }} />;
          })()
        )}
      </div>
    </MarketingChrome>
  );
}
