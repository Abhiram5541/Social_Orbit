import type { Metadata } from "next";
import { PLATFORM_LABEL } from "@/lib/contracts/common";
import { formatCompact, formatRelativeTime } from "@/lib/format";
import { requirePagePermission } from "@/server/auth/rbac";
import {
  connectorStatuses,
  databaseStats,
  reauthQueue,
} from "@/server/repositories/ops-repository";
import { PageBody, PageHeader } from "@/components/shell/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Notice } from "@/components/ui/states";
import { Table, TableWrap, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table";
import { StatRow, StatTile } from "@/components/intelligence/stat";
import { ReviewTable } from "@/components/admin/review-table";

export const metadata: Metadata = { title: "Ingestion" };
export const dynamic = "force-dynamic";

const PIPELINE = [
  { stage: "Platform API", detail: "Authoritative structured metrics from official endpoints." },
  { stage: "Raw ingestion", detail: "Provider responses stored verbatim before any transformation." },
  { stage: "Normalisation", detail: "Mapped onto the canonical model; platform quirks resolved here only." },
  { stage: "Validation", detail: "Range and continuity checks; failures enter the review queue." },
  { stage: "Snapshot", detail: "A historical row is appended. Existing rows are never overwritten." },
  { stage: "Derived metrics", detail: "Median views, engagement, cadence, consistency, growth pattern." },
  { stage: "Scoring", detail: "Deterministic formulas with stored components and a formula version." },
  { stage: "AI enrichment", detail: "Classification and explanation, asynchronous and never blocking." },
];

export default async function IngestionPage() {
  await requirePagePermission("admin:ingestion", "/admin/ingestion");
  const stats = databaseStats();
  const connectors = connectorStatuses();
  const reauth = reauthQueue();

  return (
    <>
      <PageHeader
        title="Ingestion"
        description="How observations reach the database, and what is currently blocking a refresh."
      />
      <PageBody className="space-y-4">
        <Notice tone="info" title="Refresh runs on a scheduler, not on request">
          Profile pages are served from stored observations. Ingestion, AI enrichment and
          score recalculation happen in background workers, so a slow provider never blocks
          a page render — DPR §23.
        </Notice>

        <StatRow>
          <StatTile label="Accounts tracked" value={formatCompact(stats.totalAccounts)} />
          <StatTile label="Content records" value={formatCompact(stats.totalContent)} />
          <StatTile label="Snapshots" value={formatCompact(stats.totalSnapshots)} footnote="append-only" />
          <StatTile label="Stale profiles" value={formatCompact(stats.staleProfiles)} footnote="over 48h" />
          <StatTile label="Reauth required" value={reauth.length} footnote="tokens cannot refresh" />
        </StatRow>

        <Card>
          <CardHeader>
            <CardTitle>Per-platform state</CardTitle>
          </CardHeader>
          <TableWrap label="Connector ingestion state">
            <Table>
              <Thead>
                <Tr>
                  <Th>Platform</Th>
                  <Th>State</Th>
                  <Th numeric>Accounts</Th>
                  <Th>Last successful sync</Th>
                  <Th>Blocking</Th>
                </Tr>
              </Thead>
              <Tbody>
                {connectors.map((connector) => (
                  <Tr key={connector.platform}>
                    <Td className="font-medium">{PLATFORM_LABEL[connector.platform]}</Td>
                    <Td>{connector.state.replace(/_/g, " ")}</Td>
                    <Td numeric>{formatCompact(connector.accountsTracked)}</Td>
                    <Td className="text-ink-muted">
                      {formatRelativeTime(connector.lastSuccessfulSync)}
                    </Td>
                    <Td className="font-num text-[12px] text-ink-muted">
                      {connector.missing.length > 0 ? connector.missing.join(", ") : "—"}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableWrap>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2">
              {PIPELINE.map((step, index) => (
                <li key={step.stage} className="flex gap-3">
                  <span className="mt-0.5 font-num text-[11px] tabular-nums text-ink-subtle">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span>
                    <span className="block text-[13px] font-medium text-ink">{step.stage}</span>
                    <span className="block text-[12px] leading-5 text-ink-muted">
                      {step.detail}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <div>
          <h2 className="mb-2 text-[15px] font-semibold text-ink">
            Accounts needing reauthorisation
          </h2>
          <ReviewTable
            items={reauth}
            emptyTitle="No reauthorisation needed"
            emptyDescription="Every connected account has a token that can still be refreshed."
          />
        </div>
      </PageBody>
    </>
  );
}
