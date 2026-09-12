import type { Metadata } from "next";
import { cn } from "@/lib/class-names";
import { PLAN_CONFIG } from "@/lib/contracts/auth";
import { formatNumber } from "@/lib/format";
import { requirePagePermission, can } from "@/server/auth/rbac";
import { listApiKeys } from "@/server/repositories/api-key-repository";
import { getUsage } from "@/server/repositories/usage-repository";
import { PageBody, PageHeader } from "@/components/shell/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Notice } from "@/components/ui/states";
import { DataRow, StatRow, StatTile } from "@/components/intelligence/stat";
import { ApiKeyPanel } from "@/components/api/api-key-panel";
import { ApiReference } from "@/components/api/api-reference";

export const metadata: Metadata = { title: "API" };
export const dynamic = "force-dynamic";

export default async function ApiPortalPage() {
  const user = await requirePagePermission("api_key:read", "/api-portal");
  const keys = listApiKeys(user);
  const plan = PLAN_CONFIG[user.plan];
  const used = getUsage(user.orgId, "api_request");

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="Developer API"
        description="Query the same canonical database the application runs on. Versioned, rate limited and scoped."
        meta={
          <code className="text-sm text-ink-muted">https://api.socialorbit.io/v1</code>
        }
      />
      <PageBody className="space-y-4">
        {!plan.features.api && (
          <Notice tone="caution" title="The API is not included in your plan">
            Keys can be created but requests are rejected until the organisation moves to a
            plan that includes API access.
          </Notice>
        )}

        {/* Two tiles only: constants dressed as metrics moved into the
            Authentication card, where reference facts belong. */}
        <StatRow>
          <StatTile
            label="Requests this month"
            emphasis
            value={formatNumber(used)}
            footnote={
              plan.apiRequestsPerMonth === null ? (
                "unlimited on your plan"
              ) : (
                <span className="flex items-center gap-2">
                  <span className="h-1 w-24 overflow-hidden rounded-full bg-sunken-strong">
                    <span
                      className={cn(
                        "block h-full rounded-full",
                        used >= plan.apiRequestsPerMonth ? "bg-critical" : "bg-ink",
                      )}
                      style={{
                        width: `${Math.min(100, Math.round((used / plan.apiRequestsPerMonth) * 100))}%`,
                      }}
                    />
                  </span>
                  of {plan.apiRequestsPerMonth.toLocaleString()}
                </span>
              )
            }
          />
          <StatTile label="Active keys" value={keys.filter((key) => !key.revokedAt).length} />
        </StatRow>

        <ApiKeyPanel initialKeys={keys} canWrite={can(user, "api_key:write")} />

        <Card>
          <CardHeader>
            <CardTitle>Authentication</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-base text-ink-muted">
            <p>
              Send your key as a bearer token. Session cookies are deliberately not accepted
              on <code className="text-ink">/v1</code> — a browser session and an
              API key have different revocation and audit stories.
            </p>
            {/* Light specimen: the dark surface belongs to the score readout
                alone, and code carries the mono texture from the base layer. */}
            <pre className="scroll-x rounded-lg border border-line bg-sunken px-3 py-2.5 text-sm leading-5 text-ink">
              <code>{`curl https://api.socialorbit.io/v1/influencers?country=IN&health_min=75 \\
  -H "Authorization: Bearer so_live_••••••••"`}</code>
            </pre>
            <p>
              Every response carries{" "}
              <code className="text-ink">x-socialorbit-api-version</code>. Errors use
              one shape: <code className="text-ink">{`{ "error": { "code", "message" } }`}</code>.
            </p>
            <dl>
              <DataRow label="Burst limit" value="120 / min per key" />
              <DataRow label="API version" value="v1 — stable" />
            </dl>
          </CardContent>
        </Card>

        <ApiReference />
      </PageBody>
    </>
  );
}
