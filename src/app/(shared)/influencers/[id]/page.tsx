import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CATEGORY_LABEL } from "@/lib/contracts/common";
import { requirePagePermission } from "@/server/auth/rbac";
import { toProfile } from "@/server/repositories/influencer-repository";
import { PageBody, PageHeader } from "@/components/shell/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { ProvenanceMix } from "@/components/intelligence/provenance";
import { HealthPanel } from "@/components/profile/health-panel";
import { ProfileHeader } from "@/components/profile/profile-header";
import { ProfileTabs, ProvenanceFooter } from "@/components/profile/profile-tabs";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const profile = toProfile(id);
  return { title: profile ? profile.displayName : "Influencer not found" };
}

export default async function InfluencerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requirePagePermission("influencer:read", `/influencers/${id}`);

  const profile = toProfile(id);
  if (!profile) notFound();

  // Authorized audience analytics are first-party creator data. Clients see the
  // public profile; the creator and SocialOrbit reviewers see the audience
  // breakdown (DPR §22). The route handler applies the identical rule.
  const maySeeAudience = user.orgKind === "platform" || user.influencerId === id;
  const visible =
    maySeeAudience || !profile.audience.available
      ? profile
      : {
          ...profile,
          audience: {
            available: false,
            reason:
              "Authorized audience analytics are visible to the creator and to SocialOrbit reviewers only.",
            countries: [],
            languages: [],
            ageBands: [],
            gender: [],
            provenance: null,
          },
        };

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Discovery", href: "/discovery" },
          { label: CATEGORY_LABEL[profile.categories[0]], href: `/discovery?category=${profile.categories[0]}` },
          { label: profile.displayName },
        ]}
        className="py-2.5"
      />

      <PageBody className="space-y-4">
        <ProfileHeader profile={visible} />

        <HealthPanel
          health={visible.health}
          risk={visible.riskSignals}
          confidence={visible.confidenceDetail}
          ai={visible.ai}
          benchmarks={visible.benchmarks}
        />

        <ProfileTabs profile={visible} />

        <Card>
          <CardContent className="space-y-3">
            <ProvenanceMix mix={visible.confidenceDetail.mix} />
            <ProvenanceFooter profile={visible} />
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
