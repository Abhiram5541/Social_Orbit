import type { Metadata } from "next";
import { requireOwnProfile } from "@/server/auth/creator";
import { PageBody, PageHeader } from "@/components/shell/app-shell";
import { Card, CardContent } from "@/components/ui/card";
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
        title="Your analytics"
        description="Everything SocialOrbit holds about your account, including data only you and SocialOrbit reviewers can see."
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
          <CardContent>
            <ProvenanceMix mix={profile.confidenceDetail.mix} />
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
