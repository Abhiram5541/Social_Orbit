import type { Metadata } from "next";
import { Link2, ShieldCheck, TriangleAlert } from "lucide-react";
import { PLATFORM_LABEL, SUPPORTED_PLATFORMS, type Platform } from "@/lib/contracts/common";
import { formatCompact, formatDateTime, formatRelativeTime } from "@/lib/format";
import { requireOwnProfile } from "@/server/auth/creator";
import { connectorStatuses } from "@/server/repositories/ops-repository";
import { PageBody, PageHeader } from "@/components/shell/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Notice } from "@/components/ui/states";
import { DataRow } from "@/components/intelligence/stat";

export const metadata: Metadata = { title: "Connected accounts" };
export const dynamic = "force-dynamic";

const SCOPES: Record<Platform, string[]> = {
  youtube: [
    "youtube.readonly — channel and video statistics",
    "yt-analytics.readonly — audience and retention for your own channel",
  ],
  instagram: [
    "instagram_basic — profile and media",
    "instagram_manage_insights — reach, impressions and audience for a professional account",
  ],
  tiktok: [],
};

export default async function ConnectionsPage() {
  const { profile } = await requireOwnProfile("/creator/connections");
  const connectors = connectorStatuses();

  const connectorFor = (platform: Platform) =>
    connectors.find((connector) => connector.platform === platform);

  return (
    <>
      <PageHeader
        title="Connected accounts"
        description="Connecting an account is how you become SocialOrbit Verified and how first-party analytics become available."
      />
      <PageBody className="space-y-4">
        <Notice tone="info" icon={ShieldCheck} title="What connecting does and does not do">
          SocialOrbit requests the narrowest scopes that let it read your own statistics. Your
          access tokens are encrypted at rest and never sent to a browser. SocialOrbit cannot
          post, message, or change anything on your account, and you can disconnect at any
          time — your public profile stays, your authorized analytics stop refreshing.
        </Notice>

        <div className="grid gap-4 lg:grid-cols-2">
          {SUPPORTED_PLATFORMS.map((platform) => {
            const account = profile.socialAccounts.find((entry) => entry.platform === platform);
            const connector = connectorFor(platform);
            const available = connector?.state === "live";

            return (
              <Card key={platform}>
                <CardHeader>
                  <span className="flex items-center gap-2">
                    <Link2 className="size-4 text-ink-subtle" aria-hidden />
                    <CardTitle>{PLATFORM_LABEL[platform]}</CardTitle>
                  </span>
                  <Badge
                    tone={
                      account?.needsReauth
                        ? "critical"
                        : account?.isConnected
                          ? "positive"
                          : "neutral"
                    }
                    dot
                  >
                    {account?.needsReauth
                      ? "Reauthorisation needed"
                      : account?.isConnected
                        ? "Connected"
                        : "Not connected"}
                  </Badge>
                </CardHeader>

                <CardContent className="space-y-3">
                  {account ? (
                    <dl>
                      <DataRow label="Account" value={account.handle} />
                      <DataRow label="Followers" value={formatCompact(account.followers)} />
                      <DataRow
                        label="Connected"
                        value={account.connectedAt ? formatDateTime(account.connectedAt) : "—"}
                      />
                      <DataRow
                        label="Last sync"
                        value={formatRelativeTime(account.lastSyncedAt)}
                      />
                    </dl>
                  ) : (
                    <p className="text-[13px] text-ink-muted">
                      No {PLATFORM_LABEL[platform]} account is linked to your profile yet.
                    </p>
                  )}

                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-ink-muted">
                      Scopes requested
                    </p>
                    <ul className="mt-1 space-y-1">
                      {SCOPES[platform].map((scope) => (
                        <li key={scope} className="font-num text-[11px] leading-5 text-ink-muted">
                          {scope}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {!available && (
                    <Notice tone="caution" icon={TriangleAlert}>
                      This connector is not configured in this environment, so the connection
                      flow is unavailable. Nothing is stored or attempted.
                    </Notice>
                  )}

                  <div className="flex flex-wrap gap-2 border-t border-line pt-3">
                    <Button variant="primary" disabled={!available}>
                      {account?.isConnected ? "Reconnect" : `Connect ${PLATFORM_LABEL[platform]}`}
                    </Button>
                    {account?.isConnected && (
                      <Button variant="ghost" disabled={!available}>
                        Disconnect
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </PageBody>
    </>
  );
}
