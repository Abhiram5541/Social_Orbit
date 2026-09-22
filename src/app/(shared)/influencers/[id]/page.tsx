import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CATEGORY_LABEL } from "@/lib/contracts/common";
import { discoveryHomeFor } from "@/lib/navigation";
import { can, requirePagePermission } from "@/server/auth/rbac";
import { toProfile } from "@/server/repositories/influencer-repository";
import { PageBody, PageHeader } from "@/components/shell/app-shell";
import { CalendarDays } from "lucide-react";
import { Freshness } from "@/components/intelligence/provenance";
import {
  ConfidenceCard,
  EngagementSmallCard,
  VersionsCard,
  FollowersCard,
  HealthGreenCard,
  LookalikeTable,
  ProfileChartCard,
} from "@/components/profile/profile-bento";
import { ProfileActions } from "@/components/profile/profile-actions";
import { ProfileTabs } from "@/components/profile/profile-tabs";
import { RelationshipPanel } from "@/components/crm/relationship-panel";

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
  const user = await requirePagePermission(
    "influencer:read",
    `/influencers/${id}`,
  );

  const profile = toProfile(id);
  if (!profile) notFound();

  const discoveryHome = discoveryHomeFor(user.orgKind);

  // Authorized audience analytics are first-party creator data. Clients see the
  // public profile; the creator and SENSO reviewers see the audience
  // breakdown (DPR §22). The route handler applies the identical rule.
  const maySeeAudience =
    user.orgKind === "platform" || user.influencerId === id;
  const visible =
    maySeeAudience || !profile.audience.available
      ? profile
      : {
          ...profile,
          audience: {
            available: false,
            reason:
              "Authorized audience analytics are visible to the creator and to SENSO reviewers only.",
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
        // This page is shared, so the crumbs cannot be: `/discovery` is a
        // client route that redirects platform staff straight back to /admin,
        // and a breadcrumb that bounces the person who clicks it is worse than
        // no breadcrumb at all.
        breadcrumbs={[
          { label: "Discovery", href: discoveryHome },
          ...(profile.categories[0]
            ? [
                {
                  label: CATEGORY_LABEL[profile.categories[0]],
                  href: `${discoveryHome}?category=${profile.categories[0]}`,
                },
              ]
            : []),
          { label: profile.displayName },
        ]}
        className="pb-0 pt-2"
      />

      <PageHeader
        title={
          <>
            {visible.displayName}{" "}
            <span className="font-medium text-ink-subtle">
              @{visible.primaryHandle}
            </span>
          </>
        }
        actions={
          <>
            <span className="inline-flex h-10 items-center gap-2 rounded-full bg-surface px-4 text-base font-medium text-ink">
              <CalendarDays className="size-4 text-ink-muted" aria-hidden />
              <Freshness at={visible.lastRefreshedAt} prefix="Refreshed" />
            </span>
            <ProfileActions profile={visible} />
          </>
        }
        className="pt-1"
      />

      <PageBody className="space-y-4">
        {/* Nested stacks rather than grid spans: the same composition, and
            nothing depends on a span class resolving in every engine. */}
        <div className="grid gap-4 xl:grid-cols-[minmax(0,2.95fr)_minmax(0,1.25fr)]">
          <div className="min-w-0 space-y-4">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1.9fr)]">
              <div className="flex min-w-0 flex-col gap-4">
                <HealthGreenCard profile={visible} />
                <EngagementSmallCard profile={visible} />
              </div>
              <ProfileChartCard profile={visible} />
            </div>
            <LookalikeTable profile={visible} />
          </div>
          <div className="grid min-w-0 gap-4 md:grid-cols-3 xl:grid-cols-1">
            <FollowersCard profile={visible} />
            <ConfidenceCard profile={visible} />
            <VersionsCard profile={visible} />
          </div>
        </div>

        {/* A client's own record of this creator. Platform staff read across
            tenants, so there is no single relationship to show them. */}
        {user.orgKind === "client" && can(user, "crm:read") && (
          <RelationshipPanel influencerId={visible.id} />
        )}

        <ProfileTabs profile={visible} />
      </PageBody>
    </>
  );
}
