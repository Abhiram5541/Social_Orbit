import type { Metadata } from "next";
import { Link2, ShieldCheck, TriangleAlert } from "lucide-react";
import { PLATFORM_LABEL, SUPPORTED_PLATFORMS, type Platform } from "@/lib/contracts/common";
import { formatCompact, formatDateTime, formatRelativeTime } from "@/lib/format";
import { requireOwnProfile } from "@/server/auth/creator";
import { connectorStatuses } from "@/server/repositories/ops-repository";
import { PageBody, PageHeader } from "@/components/shell/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { DisconnectButton } from "@/components/creator/disconnect-button";
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
  x: ["tweet.read — post statistics", "users.read — profile and identity match", "offline.access — stay connected"],
};

export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ connection?: string; detail?: string }>;
}) {
  const { profile } = await requireOwnProfile("/creator/connections");
  const connectors = connectorStatuses();
  const outcome = await searchParams;

  const entries = SUPPORTED_PLATFORMS.map((platform) => ({
    platform,
    account: profile.socialAccounts.find((entry) => entry.platform === platform),
    available:
      connectors.find((connector) => connector.platform === platform)?.state === "live",
  }));

  // The platform a creator can actually use — or already has data on — leads
  // full-width. Connectors unusable in this environment collapse to one row
  // each: one statement, not a disabled primary plus a warning saying the
  // same thing twice.
  const active = entries.filter((entry) => entry.available || entry.account);
  const inactive = entries.filter((entry) => !entry.available && !entry.account);

  return (
    <>
      <PageHeader
        eyebrow="My presence"
        title="Connected accounts"
        description="Connecting an account is how you become SENSO Verified and how first-party analytics become available."
      />
      <PageBody className="space-y-4">
        {outcome.connection === "connected" && (
          <Notice tone="positive" icon={ShieldCheck} title="Account connected">
            {outcome.detail ? `${outcome.detail} is now linked. ` : ""}
            Your authorized analytics will appear once they have been read for the first time.
          </Notice>
        )}
        {outcome.connection === "cancelled" && (
          <Notice tone="info" title="Connection cancelled">
            Nothing was stored. You can start again whenever you like.
          </Notice>
        )}
        {outcome.connection === "failed" && (
          <Notice tone="critical" icon={TriangleAlert} title="Connection could not be completed">
            {outcome.detail ?? "Something went wrong. Nothing was stored."}
          </Notice>
        )}

        <Notice tone="info" icon={ShieldCheck} title="What connecting does and does not do">
          SENSO requests the narrowest scopes that let it read your own statistics. Your
          access tokens are encrypted at rest and never sent to a browser. SENSO cannot
          post, message, or change anything on your account, and you can disconnect at any
          time — your public profile stays, your authorized analytics stop refreshing.
        </Notice>

        {active.map(({ platform, account, available }) => (
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
                <p className="text-base text-ink-muted">
                  No {PLATFORM_LABEL[platform]} account is linked to your profile yet.
                </p>
              )}

              {SCOPES[platform].length > 0 && (
                <div>
                  <p className="label-caps text-ink-muted">Scopes requested</p>
                  <ul className="mt-1 space-y-1">
                    {SCOPES[platform].map((scope) => (
                      <li key={scope} className="text-xs leading-5 text-ink-muted">
                        {scope}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {available ? (
                <div className="flex flex-wrap gap-2 border-t border-line pt-3">
                  {platform === "youtube" ? (
                    // A plain link, not a fetch: this leaves the app for
                    // Google's consent screen, and a redirect a browser
                    // follows itself is the whole mechanism.
                    <LinkButton href="/api/internal/connect/youtube/start" variant="primary">
                      {account?.isConnected ? "Reconnect" : "Connect YouTube"}
                    </LinkButton>
                  ) : (
                    <Button variant="primary" disabled>
                      {account?.isConnected ? "Reconnect" : `Connect ${PLATFORM_LABEL[platform]}`}
                    </Button>
                  )}
                  {account?.isConnected &&
                    (platform === "youtube" ? (
                      <DisconnectButton />
                    ) : (
                      <Button variant="ghost" disabled>
                        Disconnect
                      </Button>
                    ))}
                </div>
              ) : (
                <p className="border-t border-line pt-3 text-sm text-ink-muted">
                  This connector is not configured in this environment, so the connection flow
                  is unavailable. Nothing is stored or attempted.
                </p>
              )}
            </CardContent>
          </Card>
        ))}

        {inactive.length > 0 && (
          <Card>
            <ul className="divide-y divide-line">
              {inactive.map(({ platform }) => (
                <li key={platform} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <Link2 className="size-4 shrink-0 text-ink-subtle" aria-hidden />
                  <span className="min-w-0 flex-1 text-ink">
                    {PLATFORM_LABEL[platform]}
                    <span className="text-ink-muted">
                      {" "}
                      — connector not configured in this environment
                    </span>
                  </span>
                  <Badge tone="neutral" dot>
                    Unavailable
                  </Badge>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </PageBody>
    </>
  );
}
