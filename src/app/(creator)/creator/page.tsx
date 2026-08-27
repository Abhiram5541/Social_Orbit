import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Link2, TriangleAlert } from "lucide-react";
import { PLATFORM_LABEL } from "@/lib/contracts/common";
import { formatCompact, formatPercent, formatRelativeTime } from "@/lib/format";
import { requireOwnProfile } from "@/server/auth/creator";
import { PageBody, PageHeader } from "@/components/shell/app-shell";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Notice } from "@/components/ui/states";
import { StatRow, StatTile } from "@/components/intelligence/stat";
import { ConfidenceMeter } from "@/components/intelligence/provenance";
import { ScoreRing } from "@/components/intelligence/score";

export const metadata: Metadata = { title: "Creator overview" };
export const dynamic = "force-dynamic";

export default async function CreatorOverviewPage() {
  const { user, profile } = await requireOwnProfile("/creator");

  const connected = profile.socialAccounts.filter((account) => account.isConnected);
  const needsReauth = profile.socialAccounts.filter((account) => account.needsReauth);

  // Profile completion is measured from what is actually filled in, so the
  // number moves when the creator does something.
  const checks = [
    { done: Boolean(profile.bio), label: "Add a bio" },
    { done: connected.length > 0, label: "Connect a platform" },
    { done: profile.verification === "verified", label: "Complete verification" },
    { done: profile.audience.available, label: "Authorise audience insights" },
    { done: profile.categories.length > 0, label: "Confirm your categories" },
  ];
  const completion = Math.round((checks.filter((check) => check.done).length / checks.length) * 100);

  return (
    <>
      <PageHeader
        title={`Welcome back, ${user.name.split(" ")[0]}.`}
        description="This is what brands see when they open your SocialOrbit profile."
        actions={
          <LinkButton href={`/influencers/${profile.id}`} className="gap-1.5">
            Preview public profile
          </LinkButton>
        }
      />

      <PageBody className="space-y-4">
        {needsReauth.length > 0 && (
          <Notice
            tone="critical"
            icon={TriangleAlert}
            title="A connection needs reauthorising"
            action={
              <LinkButton href="/creator/connections" variant="primary" size="sm">
                Reconnect
              </LinkButton>
            }
          >
            {needsReauth.map((account) => PLATFORM_LABEL[account.platform]).join(", ")} can no
            longer refresh. Your authorized metrics are frozen at the last successful sync
            until you reconnect.
          </Notice>
        )}

        {profile.verification !== "verified" && (
          <Notice
            tone="caution"
            icon={BadgeCheck}
            title="You are not verified yet"
            action={
              <LinkButton href="/creator/verification" variant="primary" size="sm">
                Get verified
              </LinkButton>
            }
          >
            Verified creators appear with a badge in search and unlock first-party audience
            analytics. Verification requires connecting an account — it is never granted from
            public data.
          </Notice>
        )}

        <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
          <Card>
            <CardHeader>
              <CardTitle>Your SocialOrbit Health</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-5">
              <ScoreRing value={profile.healthScore} size={96} />
              <div className="min-w-40 flex-1 space-y-2">
                <p className="text-[13px] leading-5 text-ink-muted">
                  Computed from nine weighted components by a published formula. Nothing here
                  is a subjective rating — every input is a measurement we can show you.
                </p>
                <ConfidenceMeter confidence={profile.confidenceDetail} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Profile completion</CardTitle>
              <span className="font-num text-[13px] tabular-nums text-ink">{completion}%</span>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="h-1.5 overflow-hidden rounded-full bg-line">
                <div className="h-full rounded-full bg-brand" style={{ width: `${completion}%` }} />
              </div>
              <ul className="space-y-1.5">
                {checks.map((check) => (
                  <li key={check.label} className="flex items-center gap-2 text-[13px]">
                    <span
                      className={`size-1.5 rounded-full ${check.done ? "bg-positive" : "bg-line-strong"}`}
                      aria-hidden
                    />
                    <span className={check.done ? "text-ink-muted line-through" : "text-ink"}>
                      {check.label}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <StatRow>
          <StatTile label="Followers" value={formatCompact(profile.glance.followers)} emphasis />
          <StatTile label="Median views" value={formatCompact(profile.glance.medianViews)} />
          <StatTile label="Engagement" value={formatPercent(profile.glance.engagementRate)} />
          <StatTile label="Content indexed" value={formatCompact(profile.glance.contentCount)} />
          <StatTile
            label="Last refresh"
            value={formatRelativeTime(profile.lastRefreshedAt)}
            footnote="scheduled sync"
          />
        </StatRow>

        <Card>
          <CardHeader>
            <CardTitle>Connected accounts</CardTitle>
            <Link href="/creator/connections" className="rounded text-[13px] font-medium text-brand-ink hover:underline">
              Manage
            </Link>
          </CardHeader>
          <ul className="divide-y divide-line">
            {profile.socialAccounts.map((account) => (
              <li key={account.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <Link2 className="size-4 shrink-0 text-ink-subtle" aria-hidden />
                <span className="min-w-40 flex-1">
                  <span className="block text-[14px] font-medium text-ink">
                    {PLATFORM_LABEL[account.platform]}
                  </span>
                  <span className="block font-num text-[12px] text-ink-muted">
                    {account.handle}
                  </span>
                </span>
                <span className="font-num text-[13px] tabular-nums text-ink">
                  {formatCompact(account.followers)}
                </span>
                <Badge
                  tone={
                    account.needsReauth ? "critical" : account.isConnected ? "positive" : "neutral"
                  }
                  dot
                >
                  {account.needsReauth
                    ? "Reauthorise"
                    : account.isConnected
                      ? "Connected"
                      : "Not connected"}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      </PageBody>
    </>
  );
}
