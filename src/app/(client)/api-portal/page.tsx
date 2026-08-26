import type { Metadata } from "next";
import { PLAN_CONFIG } from "@/lib/contracts/auth";
import { requirePagePermission, can } from "@/server/auth/rbac";
import { listApiKeys } from "@/server/repositories/api-key-repository";
import { getUsage } from "@/server/repositories/usage-repository";
import { PageBody, PageHeader } from "@/components/shell/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Notice } from "@/components/ui/states";
import { StatRow, StatTile } from "@/components/intelligence/stat";
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
        title="Developer API"
        description="Query the same canonical database the application runs on. Versioned, rate limited and scoped."
      />
      <PageBody className="space-y-4">
        {!plan.features.api && (
          <Notice tone="caution" title="The API is not included in your plan">
            Keys can be created but requests are rejected until the organisation moves to a
            plan that includes API access.
          </Notice>
        )}

        <StatRow>
          <StatTile label="Active keys" value={keys.filter((key) => !key.revokedAt).length} />
          <StatTile
            label="Requests this month"
            value={used}
            footnote={
              plan.apiRequestsPerMonth === null
                ? "unlimited on your plan"
                : `of ${plan.apiRequestsPerMonth.toLocaleString()}`
            }
          />
          <StatTile label="Burst limit" value="120 / min" footnote="per key" />
          <StatTile label="API version" value="v1" footnote="stable" />
        </StatRow>

        <ApiKeyPanel initialKeys={keys} canWrite={can(user, "api_key:write")} />

        <Card>
          <CardHeader>
            <CardTitle>Authentication</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-[13px] leading-5 text-ink-muted">
            <p>
              Send your key as a bearer token. Session cookies are deliberately not accepted
              on <code className="font-mono text-ink">/v1</code> — a browser session and an
              API key have different revocation and audit stories.
            </p>
            <pre className="scroll-x rounded-lg bg-ink px-3 py-2.5 font-mono text-[12px] leading-5 text-ink-inverse">
              <code>{`curl https://api.socialorbit.io/v1/influencers?country=IN&health_min=75 \\
  -H "Authorization: Bearer so_live_••••••••"`}</code>
            </pre>
            <p>
              Every response carries{" "}
              <code className="font-mono text-ink">x-socialorbit-api-version</code>. Errors use
              one shape: <code className="font-mono text-ink">{`{ "error": { "code", "message" } }`}</code>.
            </p>
          </CardContent>
        </Card>

        <ApiReference />
      </PageBody>
    </>
  );
}
