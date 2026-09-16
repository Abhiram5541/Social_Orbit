import type { Metadata } from "next";
import { requireOwnProfile } from "@/server/auth/creator";
import { PageBody, PageHeader } from "@/components/shell/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Notice } from "@/components/ui/states";
import { ProvenanceMix } from "@/components/intelligence/provenance";
import { HealthPanel } from "@/components/profile/health-panel";
import { ProfileTabs } from "@/components/profile/profile-tabs";

export const metadata: Metadata = { title: "Your analytics" };
export const dynamic = "force-dynamic";

/**
 * The creator sees their own record in full, including the authorized audience
 * data a client would not be shown. Access is resolved from the session, not
 * from a route parameter.
 */
export default async function CreatorAnalyticsPage() {
  const { profile } = await requireOwnProfile("/creator/analytics");

  return (
    <>
      <PageHeader
        eyebrow="Performance"
        title="Your analytics"
        description="Everything SENSO holds about your account, including data only you and SENSO reviewers can see."
      />
      <PageBody className="space-y-4">
        {profile.audience.available && (
          <Notice tone="info" title="Audience data is visible to you only">
            Demographics come from your connected professional account. Clients browsing your
            public profile do not see them.
          </Notice>
        )}

        <HealthPanel
          health={profile.health}
          risk={profile.riskSignals}
          confidence={profile.confidenceDetail}
          ai={profile.ai}
          benchmarks={profile.benchmarks}
        />

        <ProfileTabs profile={profile} linkToProfiles={false} />

        <Card>
          <CardHeader>
            <CardTitle>Where your record comes from</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-base text-ink-muted">
              Every figure is tiered by how it was obtained — an authorised connection
              outranks an official API read, which outranks anything a model inferred.
            </p>
            <ProvenanceMix mix={profile.confidenceDetail.mix} />
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
