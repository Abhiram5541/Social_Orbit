import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Lock, ShieldCheck } from "lucide-react";
import { requirePageSession } from "@/server/auth/rbac";
import { ROLE_WORKSPACE } from "@/lib/contracts/auth";
import { PageBody, PageHeader } from "@/components/shell/app-shell";
import { LinkButton } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Notice } from "@/components/ui/states";

export const metadata: Metadata = { title: "How verification works" };
export const dynamic = "force-dynamic";

const STEPS = [
  {
    heading: "The creator claims their profile",
    body: "A creator signs up and claims the SocialOrbit record that represents them. Claiming alone grants nothing — it only establishes who is asking.",
  },
  {
    heading: "They connect a platform account",
    body: "The creator completes the platform's own OAuth consent screen. SocialOrbit requests the narrowest scopes that let it read that creator's statistics, and stores the resulting tokens encrypted. Tokens are never sent to a browser.",
  },
  {
    heading: "SocialOrbit matches the identity",
    body: "The connected platform identity is compared against the claimed profile. If the connected account is not the account on the profile, verification fails and no badge is issued.",
  },
  {
    heading: "The badge is issued",
    body: "Only after that match passes. Verified profiles carry first-party metrics, a higher confidence score, and the badge shown in search results and comparisons.",
  },
];

export default async function VerificationHelpPage() {
  const user = await requirePageSession("/help/verification");
  const isCreator = ROLE_WORKSPACE[user.role] === "influencer";

  return (
    <>
      <PageHeader
        title="How verification works"
        description="What SocialOrbit Verified means, and what it deliberately does not mean."
        breadcrumbs={[{ label: "Help", href: "/help" }, { label: "Verification" }]}
        actions={
          isCreator ? (
            <LinkButton href="/creator/verification" variant="primary">
              Check your status
            </LinkButton>
          ) : undefined
        }
      />
      <PageBody className="max-w-3xl space-y-4">
        <Notice tone="info" icon={ShieldCheck} title="Verification is never inferred">
          The badge is issued only after a creator connects an account and the identity match
          passes. It is never granted from public data collection, however confident that data
          looks, and a client cannot request it on a creator&apos;s behalf.
        </Notice>

        <Card>
          <CardHeader>
            <span className="flex items-center gap-2">
              <BadgeCheck className="size-4 text-verified" aria-hidden />
              <CardTitle>The four steps</CardTitle>
            </span>
          </CardHeader>
          <ol className="divide-y divide-line">
            {STEPS.map((step, index) => (
              <li key={step.heading} className="flex gap-3 px-4 py-3">
                <span
                  className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-ink font-num text-[11px] font-semibold text-ink-inverse"
                  aria-hidden
                >
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block text-[14px] font-semibold text-ink">
                    {step.heading}
                  </span>
                  <span className="block text-[13px] leading-6 text-ink-muted">{step.body}</span>
                </span>
              </li>
            ))}
          </ol>
        </Card>

        <Card>
          <CardHeader>
            <span className="flex items-center gap-2">
              <Lock className="size-4 text-ink-subtle" aria-hidden />
              <CardTitle>The three statuses</CardTitle>
            </span>
          </CardHeader>
          <CardContent className="space-y-3 text-[13px] leading-6 text-ink-muted">
            <p>
              <span className="font-semibold text-ink">SocialOrbit Verified</span> — an account
              is connected and the identity match passed. Authorized first-party metrics are
              available and confidence is higher.
            </p>
            <p>
              <span className="font-semibold text-ink">Verification pending</span> — an account
              is connected but the checks have not completed. Metrics from that connection are
              not yet treated as verified.
            </p>
            <p>
              <span className="font-semibold text-ink">Unverified</span> — the profile is built
              from public platform data. The numbers are real measurements, but SocialOrbit
              cannot confirm who owns the account, and audience demographics are unavailable
              because no authorised source provides them.
            </p>
          </CardContent>
        </Card>

        <p className="text-[13px] text-ink-muted">
          More on how the underlying numbers are produced in{" "}
          <Link href="/help" className="rounded font-medium text-brand-ink underline underline-offset-2">
            Help
          </Link>
          .
        </p>
      </PageBody>
    </>
  );
}
