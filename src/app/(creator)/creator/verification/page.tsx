import type { Metadata } from "next";
import { BadgeCheck, Check } from "lucide-react";
import { PLATFORM_LABEL } from "@/lib/contracts/common";
import { formatDateTime } from "@/lib/format";
import { requireOwnProfile } from "@/server/auth/creator";
import { PageBody, PageHeader } from "@/components/shell/app-shell";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataRow } from "@/components/intelligence/stat";

export const metadata: Metadata = { title: "Verification" };
export const dynamic = "force-dynamic";

export default async function VerificationPage() {
  const { profile } = await requireOwnProfile("/creator/verification");
  const connected = profile.socialAccounts.some((account) => account.isConnected);
  const matched =
    profile.socialAccounts.find((account) => account.isConnected) ??
    profile.socialAccounts.find((account) => account.connectedAt);

  const steps = [
    {
      label: "Create or claim your profile",
      detail: "Your SocialOrbit record exists and you are signed in as its owner.",
      done: true,
    },
    {
      label: "Connect a platform account",
      detail: "Complete the OAuth consent flow for at least one supported platform.",
      done: connected,
    },
    {
      label: "Identity match",
      detail:
        "SocialOrbit confirms the connected platform identity is the same account as the profile you claimed.",
      done: profile.verification === "verified",
    },
    {
      label: "Verified badge issued",
      detail:
        "Your profile shows SocialOrbit Verified, and authorized first-party analytics become available.",
      done: profile.verification === "verified",
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="My presence"
        title="Verification"
        description="SocialOrbit Verified is issued only after an account connection and a successful identity match — never from public data."
        actions={
          <Badge
            tone={
              profile.verification === "verified"
                ? "brand"
                : profile.verification === "pending"
                  ? "caution"
                  : "neutral"
            }
          >
            {profile.verification === "verified"
              ? "SocialOrbit Verified"
              : profile.verification === "pending"
                ? "Pending checks"
                : "Unverified"}
          </Badge>
        }
      />
      <PageBody className="space-y-4">
        <Card>
          <CardHeader>
            <span className="flex items-center gap-2">
              <BadgeCheck className="size-4 text-verified" aria-hidden />
              <CardTitle>Your progress</CardTitle>
            </span>
          </CardHeader>
          <ol className="divide-y divide-line">
            {steps.map((step, index) => (
              <li key={step.label} className="flex gap-3 px-4 py-3">
                <span
                  className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-xs font-medium ${
                    step.done
                      ? "bg-positive text-white"
                      : "border border-line-strong text-ink-subtle"
                  }`}
                  aria-hidden
                >
                  {step.done ? <Check className="size-3" strokeWidth={3} aria-hidden /> : index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block font-medium text-ink">{step.label}</span>
                  <span className="block text-base text-ink-muted">
                    {step.detail}
                  </span>
                </span>
              </li>
            ))}
          </ol>
          <CardContent className="border-t border-line">
            {profile.verification === "verified" ? (
              // The payoff of the whole journey: the badge at weight, and the
              // identity-match record itself — verified provenance, on show.
              <div className="space-y-2">
                <p className="flex items-center gap-2">
                  <BadgeCheck className="size-5 text-verified" aria-hidden />
                  <span className="text-md font-semibold text-ink">SocialOrbit Verified</span>
                </p>
                {matched && (
                  <dl>
                    <DataRow label="Platform" value={PLATFORM_LABEL[matched.platform]} />
                    <DataRow label="Account" value={matched.handle} />
                    {matched.connectedAt && (
                      <DataRow label="Matched" value={formatDateTime(matched.connectedAt)} />
                    )}
                    <DataRow label="Method" value="OAuth account match" />
                  </dl>
                )}
              </div>
            ) : (
              <LinkButton href="/creator/connections" variant="primary">
                {connected ? "Review your connections" : "Connect an account"}
              </LinkButton>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Why this matters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-base text-ink-muted">
            <p>
              Brands filter by verification. An unverified profile is built from public data
              alone: the numbers are real, but SocialOrbit cannot confirm you own the account,
              and audience demographics are unavailable because no authorised source provides
              them.
            </p>
            <p>
              A verified profile carries first-party metrics, a higher confidence score, and a
              badge that appears in every search result and comparison.
            </p>
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
