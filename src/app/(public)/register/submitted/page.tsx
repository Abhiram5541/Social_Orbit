import type { Metadata } from "next";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { MarketingChrome } from "@/components/shell/marketing-chrome";
import { EmptyState } from "@/components/ui/states";
import { LinkButton } from "@/components/ui/button";

export const metadata: Metadata = { title: "Request received" };

export default function RegistrationSubmittedPage() {
  return (
    <MarketingChrome>
      <div className="mx-auto max-w-lg px-4 py-16 sm:px-6">
        <EmptyState
          icon={MailCheck}
          title="Request received"
          description={
            <>
              We review every account request before granting access to the influencer
              database. You will hear from us by email, usually within one business day.
            </>
          }
          action={
            <LinkButton href="/" size="sm">
              Back to homepage
            </LinkButton>
          }
        />
        <p className="mt-4 text-center text-[13px] text-ink-muted">
          Already approved?{" "}
          <Link href="/login" className="rounded font-medium text-brand-ink hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </MarketingChrome>
  );
}
