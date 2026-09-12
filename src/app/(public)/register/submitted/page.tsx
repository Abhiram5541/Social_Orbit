import type { Metadata } from "next";
import Link from "next/link";
import { MarketingChrome } from "@/components/shell/marketing-chrome";

export const metadata: Metadata = { title: "Request received" };

/* A receipt, not an absence: what happens next, in the order it happens,
   rather than the empty-state grammar of "nothing here". */
export default async function RegistrationSubmittedPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <MarketingChrome>
      <div className="mx-auto max-w-lg px-4 py-16 sm:px-6">
        <h1 className="text-title font-semibold tracking-display text-ink">Request received</h1>
        <p className="mt-2 leading-6 text-ink-muted">
          We review every account request before granting access to the influencer database.
        </p>
        {email && (
          <p className="mt-3 text-base text-ink-muted">
            Submitted for <span className="font-num text-ink">{email}</span>
          </p>
        )}

        <ol className="mt-8 border-t border-line">
          <li className="flex gap-3 border-b border-line py-4">
            <span className="pt-0.5 font-num text-xs text-ink-subtle">01</span>
            <p className="text-base leading-5 text-ink-muted">
              A person reviews the request, usually within one business day.
            </p>
          </li>
          <li className="flex gap-3 border-b border-line py-4">
            <span className="pt-0.5 font-num text-xs text-ink-subtle">02</span>
            <p className="text-base leading-5 text-ink-muted">
              Approval and sign-in details arrive by email.
            </p>
          </li>
        </ol>

        <p className="mt-6 text-base text-ink-muted">
          Already approved?{" "}
          <Link href="/login" className="rounded font-medium text-brand-ink hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </MarketingChrome>
  );
}
