import type { Metadata } from "next";
import { Megaphone } from "lucide-react";
import { requireOwnProfile } from "@/server/auth/creator";
import { PageBody, PageHeader } from "@/components/shell/app-shell";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, Notice } from "@/components/ui/states";

export const metadata: Metadata = { title: "Campaigns" };
export const dynamic = "force-dynamic";

export default async function CreatorCampaignsPage() {
  const { profile } = await requireOwnProfile("/creator/campaigns");

  return (
    <>
      <PageHeader
        eyebrow="Performance"
        title="Campaigns"
        description="Campaigns you have been invited to, and how your posts performed against each tracking hashtag."
      />
      <PageBody className="space-y-4">
        <Notice tone="info" title="What brands can and cannot see">
          A brand running a campaign sees the performance of posts you published carrying
          their tracking hashtag. They do not see your other campaigns, your rates with other
          brands, or your audience demographics.
        </Notice>

        <Card>
          {/* The future row's anatomy as a ghost header, so the empty state
              shows the shape of what will arrive, not just its name. */}
          {/* The ghosted header that teaches the shape of the table this
              empty state will fill. Recessed with a token, not with opacity:
              opacity-60 over text-ink-muted lands at 4.1:1 and fails AA, and
              the fact that the row is aria-hidden does not make unreadable
              text acceptable to a sighted low-vision reader. */}
          <div
            aria-hidden
            className="flex items-center gap-4 border-b border-line px-4 py-2"
          >
            <span className="label-caps min-w-0 flex-1 text-ink-subtle">Campaign</span>
            <span className="label-caps w-24 shrink-0 text-ink-subtle">Hashtag</span>
            <span className="label-caps hidden w-28 shrink-0 text-right text-ink-subtle sm:block">
              Attributed posts
            </span>
            <span className="label-caps w-20 shrink-0 text-right text-ink-subtle">Reach</span>
          </div>
          <EmptyState
            icon={Megaphone}
            title="No campaign invitations"
            description="When a brand adds you to a campaign you will see it here, along with the tracking hashtag and the performance of your attributed posts."
            action={
              profile.verification !== "verified" ? (
                <LinkButton href="/creator/verification" variant="primary" size="sm">
                  Get verified
                </LinkButton>
              ) : (
                <LinkButton href={`/influencers/${profile.id}`} size="sm">
                  Preview public profile
                </LinkButton>
              )
            }
          />
        </Card>
      </PageBody>
    </>
  );
}
