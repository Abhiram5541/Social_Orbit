import type { Metadata } from "next";
import { CATEGORY_LABEL } from "@/lib/contracts/common";
import { formatDate } from "@/lib/format";
import { requireOwnProfile } from "@/server/auth/creator";
import { PageBody, PageHeader } from "@/components/shell/app-shell";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Notice } from "@/components/ui/states";
import { DataRow } from "@/components/intelligence/stat";
import { ConfidenceMeter } from "@/components/intelligence/provenance";
import { ProfileHeader } from "@/components/profile/profile-header";

export const metadata: Metadata = { title: "Your profile" };
export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  draft: { label: "Draft", tone: "neutral" },
  in_review: { label: "In review", tone: "caution" },
  published: { label: "Published", tone: "positive" },
  archived: { label: "Archived", tone: "neutral" },
};

export default async function CreatorProfilePage() {
  const { profile } = await requireOwnProfile("/creator/profile");

  return (
    <>
      <PageHeader
        eyebrow="My presence"
        title="Your profile"
        description="How brands see you. Platform metrics come from your connected accounts and cannot be edited."
        actions={
          <LinkButton href="/creator/corrections" className="gap-1.5">
            Request a correction
          </LinkButton>
        }
      />
      <PageBody className="space-y-4">
        <Notice tone="info" title="What you can and cannot change">
          Descriptive fields — bio, categories, contact preferences — are yours to edit.
          Followers, views, engagement and every score are measurements or calculations, so
          they are not editable by anyone. If a measurement looks wrong, open a correction
          request and a reviewer will check the source.
        </Notice>

        <ProfileHeader profile={profile} showClientActions={false} />

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Profile record</CardTitle>
            </CardHeader>
            <CardContent>
              <dl>
                <DataRow label="Profile id" value={profile.id} />
                <DataRow
                  label="Status"
                  value={
                    <Badge tone={STATUS[profile.status]?.tone ?? "neutral"} dot>
                      {STATUS[profile.status]?.label ?? profile.status}
                    </Badge>
                  }
                />
                <DataRow label="Country" value={profile.countryName ?? "—"} />
                <DataRow label="Languages" value={profile.languages.join(", ").toUpperCase()} />
                <DataRow
                  label="Categories"
                  value={profile.categories.map((c) => CATEGORY_LABEL[c]).join(", ")}
                />
                <DataRow label="Created" value={formatDate(profile.createdAt)} />
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Data confidence</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-base text-ink-muted">
                Confidence measures how much SENSO can vouch for your numbers — how
                complete the record is, how much history exists, and how authoritative the
                sources are. It is separate from your health score.
              </p>
              <ConfidenceMeter confidence={profile.confidenceDetail} />
              {/* Components in the hairline-bar grammar, each against its
                  maximum contribution so the figure carries its own scale. */}
              <div className="space-y-2.5 border-t border-line pt-3">
                {(
                  [
                    ["Data completeness", profile.confidenceDetail.components.dataCompleteness, 30],
                    ["Historical depth", profile.confidenceDetail.components.historicalDepth, 25],
                    ["Source authority", profile.confidenceDetail.components.sourceAuthority, 25],
                  ] as const
                ).map(([label, value, max]) => (
                  <div key={label} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
                    <span className="flex min-w-0 items-baseline gap-1.5">
                      <span className="truncate text-sm text-ink-muted">{label}</span>
                      <span className="shrink-0 font-num text-2xs text-ink-muted">of {max}</span>
                    </span>
                    <span className="font-num text-base font-semibold text-ink">
                      {value.toFixed(1)}
                    </span>
                    <div className="col-span-2 h-1 overflow-hidden rounded-sm bg-line">
                      <div
                        className="h-full rounded-sm bg-neutral-metric"
                        style={{ width: `${Math.min(100, (value / max) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
                {/* The penalty subtracts, so it wears caution rather than the
                    neutral metric tone. */}
                <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
                  <span className="flex min-w-0 items-baseline gap-1.5">
                    <span className="truncate text-sm text-ink-muted">Staleness penalty</span>
                    <span className="shrink-0 font-num text-2xs text-ink-muted">of 25</span>
                  </span>
                  <span className="font-num text-base font-semibold text-caution">
                    −{profile.confidenceDetail.components.staleDataPenalty.toFixed(1)}
                  </span>
                  <div className="col-span-2 h-1 overflow-hidden rounded-sm bg-line">
                    <div
                      className="h-full rounded-sm bg-caution"
                      style={{
                        width: `${Math.min(100, (profile.confidenceDetail.components.staleDataPenalty / 25) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </PageBody>
    </>
  );
}
