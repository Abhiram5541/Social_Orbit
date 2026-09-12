import type { Metadata } from "next";
import { requirePagePermission } from "@/server/auth/rbac";
import {
  aiProviderStatuses,
  connectorStatuses,
  databaseStats,
} from "@/server/repositories/ops-repository";
import { PageBody, PageHeader } from "@/components/shell/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataRow, StatRow, StatTile } from "@/components/intelligence/stat";

export const metadata: Metadata = { title: "System health" };
export const dynamic = "force-dynamic";

export default async function SystemHealthPage() {
  await requirePagePermission("admin:system_health", "/admin/health");
  const stats = databaseStats();
  const connectors = connectorStatuses();
  const providers = aiProviderStatuses();

  // The badge states the condition; the note carries only its consequence.
  const dependencies = [
    {
      name: "Application",
      detail: "Next.js route handlers and the shared service layer",
      ok: true,
      note: null,
    },
    {
      name: "PostgreSQL",
      detail: "Canonical store for influencers, snapshots, scores and tenant data",
      ok: Boolean(process.env.DATABASE_URL),
      note: process.env.DATABASE_URL ? null : "running on the development data driver",
    },
    {
      name: "Redis",
      detail: "Queues, rate limiting and hot-profile cache",
      ok: Boolean(process.env.REDIS_URL),
      note: process.env.REDIS_URL
        ? null
        : "rate limits are per-process and jobs run inline",
    },
    {
      name: "Object storage",
      detail: "Generated reports and exports",
      ok: Boolean(process.env.STORAGE_BUCKET),
      note: null,
    },
    {
      name: "Token encryption key",
      detail: "Encrypts OAuth access and refresh tokens at rest",
      ok: Boolean(process.env.TOKEN_ENCRYPTION_KEY),
      note: process.env.TOKEN_ENCRYPTION_KEY
        ? null
        : "OAuth connections cannot be stored safely",
    },
  ];
  const configured = dependencies.filter((dependency) => dependency.ok).length;

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="System health"
        description="What is configured in this environment, and what the platform is currently holding."
      />
      <PageBody className="space-y-4">
        {/* This page's task is the environment — coverage totals live on the
            overview. */}
        <StatRow>
          <StatTile
            label="Dependencies configured"
            value={configured}
            footnote={`of ${dependencies.length}`}
            emphasis
          />
          <StatTile
            label="Live connectors"
            value={connectors.filter((connector) => connector.state === "live").length}
            footnote={`of ${connectors.length}`}
          />
        </StatRow>

        <Card>
          <CardHeader>
            <CardTitle>Dependencies</CardTitle>
          </CardHeader>
          <ul className="divide-y divide-line">
            {dependencies.map((dependency) => (
              <li
                key={dependency.name}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5"
              >
                <span className="min-w-40 flex-1">
                  <span className="block font-medium text-ink">{dependency.name}</span>
                  <span className="block text-sm text-ink-muted">{dependency.detail}</span>
                </span>
                {dependency.note && (
                  <span className="text-sm text-ink-muted">{dependency.note}</span>
                )}
                <Badge tone={dependency.ok ? "positive" : "caution"} dot>
                  {dependency.ok ? "OK" : "Not configured"}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Data quality</CardTitle>
            </CardHeader>
            <CardContent>
              <dl>
                <DataRow label="Published profiles" value={stats.published} />
                <DataRow label="Awaiting review" value={stats.inReview} />
                <DataRow label="SocialOrbit Verified" value={stats.verified} />
                <DataRow label="Connection pending" value={stats.connectionPending} />
                <DataRow label="With authorized audience data" value={stats.withAuthorizedAudience} />
                <DataRow label="Stale over 48h" value={stats.staleProfiles} />
                <DataRow label="Preliminary confidence" value={stats.lowConfidenceProfiles} />
                <DataRow label="Open source conflicts" value={stats.conflictedProfiles} />
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>AI layer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {providers.map((provider) => (
                <div key={provider.id} className="flex items-center justify-between gap-2 border-b border-line py-1.5 last:border-0">
                  <span className="text-base text-ink">{provider.label}</span>
                  <Badge tone={provider.configured ? "positive" : "caution"} dot>
                    {provider.configured ? (provider.model ?? "configured") : "not configured"}
                  </Badge>
                </div>
              ))}
              <p className="pt-1 text-sm text-ink-muted">
                With no provider configured, profiles still ingest, score and serve. AI
                classification fields simply stay empty rather than being guessed.
              </p>
            </CardContent>
          </Card>
        </div>
      </PageBody>
    </>
  );
}
