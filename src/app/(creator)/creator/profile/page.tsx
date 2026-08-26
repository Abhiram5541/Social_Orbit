import type { Metadata } from "next";
import { CATEGORY_LABEL } from "@/lib/contracts/common";
import { formatDate } from "@/lib/format";
import { requireOwnProfile } from "@/server/auth/creator";
import { PageBody, PageHeader } from "@/components/shell/app-shell";
import { LinkButton } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Notice } from "@/components/ui/states";
import { DataRow } from "@/components/intelligence/stat";
import { ProfileHeader } from "@/components/profile/profile-header";

export const metadata: Metadata = { title: "Your profile" };
export const dynamic = "force-dynamic";

export default async function CreatorProfilePage() {
  const { profile } = await requireOwnProfile("/creator/profile");

  return (
    <>
      <PageHeader
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

        <ProfileHeader profile={profile} />

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Profile record</CardTitle>
            </CardHeader>
            <CardContent>
              <dl>
                <DataRow label="Profile id" value={profile.id} />
                <DataRow label="Status" value={profile.status} />
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
              <p className="text-[13px] leading-5 text-ink-muted">
                Confidence measures how much SocialOrbit can vouch for your numbers — how
                complete the record is, how much history exists, and how authoritative the
                sources are. It is separate from your health score.
              </p>
              <dl>
                <DataRow
                  label="Overall"
                  value={`${Math.round(profile.confidenceDetail.score)}% (${profile.confidenceDetail.band})`}
                />
                <DataRow
                  label="Data completeness"
                  value={profile.confidenceDetail.components.dataCompleteness.toFixed(1)}
                />
                <DataRow
                  label="Historical depth"
                  value={profile.confidenceDetail.components.historicalDepth.toFixed(1)}
                />
                <DataRow
                  label="Source authority"
                  value={profile.confidenceDetail.components.sourceAuthority.toFixed(1)}
                />
                <DataRow
                  label="Staleness penalty"
                  value={`−${profile.confidenceDetail.components.staleDataPenalty.toFixed(1)}`}
                />
              </dl>
            </CardContent>
          </Card>
        </div>
      </PageBody>
    </>
  );
}
