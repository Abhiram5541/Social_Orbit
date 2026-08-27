import type { Metadata } from "next";
import { PLAN_CONFIG } from "@/lib/contracts/auth";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import { requirePagePermission } from "@/server/auth/rbac";
import { listApiKeys } from "@/server/repositories/api-key-repository";
import { listOrgs } from "@/server/repositories/user-repository";
import { getUsage } from "@/server/repositories/usage-repository";
import { PageBody, PageHeader } from "@/components/shell/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableWrap, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table";
import { StatRow, StatTile } from "@/components/intelligence/stat";
import { ApiReference } from "@/components/api/api-reference";

export const metadata: Metadata = { title: "API management" };
export const dynamic = "force-dynamic";

export default async function AdminApiPage() {
  const user = await requirePagePermission("api_key:read", "/admin/api");
  const keys = listApiKeys(user);
  const orgs = await listOrgs();

  const active = keys.filter((key) => !key.revokedAt);
  const totalRequests = orgs.reduce((sum, org) => sum + getUsage(org.id, "api_request"), 0);

  return (
    <>
      <PageHeader
        title="API management"
        description="Every issued key across all tenants, and the plan limits applied to each."
      />
      <PageBody className="space-y-4">
        <StatRow>
          <StatTile label="Active keys" value={active.length} footnote={`${keys.length} issued`} />
          <StatTile label="Revoked" value={keys.length - active.length} />
          <StatTile label="Requests this month" value={totalRequests} />
          <StatTile label="Burst limit" value="120 / min" footnote="per key" />
        </StatRow>

        <Card>
          <CardHeader>
            <CardTitle>Issued keys</CardTitle>
            <span className="text-[12px] text-ink-muted">
              Only hashes are stored; secrets cannot be recovered from here either.
            </span>
          </CardHeader>
          <TableWrap label="All API keys">
            <Table>
              <Thead>
                <Tr>
                  <Th>Name</Th>
                  <Th>Prefix</Th>
                  <Th>Scopes</Th>
                  <Th>Created</Th>
                  <Th>Last used</Th>
                  <Th>Status</Th>
                </Tr>
              </Thead>
              <Tbody>
                {keys.map((key) => (
                  <Tr key={key.id}>
                    <Td className="font-medium">{key.name}</Td>
                    <Td>
                      <code className="font-num text-[12px] text-ink-muted">{key.prefix}…</code>
                    </Td>
                    <Td className="font-num text-[11px] text-ink-muted">
                      {key.scopes.join(", ")}
                    </Td>
                    <Td className="whitespace-nowrap text-[12px] text-ink-muted">
                      {formatDateTime(key.createdAt)}
                    </Td>
                    <Td className="whitespace-nowrap text-[12px] text-ink-muted">
                      {key.lastUsedAt ? formatRelativeTime(key.lastUsedAt) : "never"}
                    </Td>
                    <Td>
                      <Badge tone={key.revokedAt ? "critical" : "positive"} dot>
                        {key.revokedAt ? "Revoked" : "Active"}
                      </Badge>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableWrap>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Plan limits</CardTitle>
          </CardHeader>
          <TableWrap label="Plan API limits">
            <Table>
              <Thead>
                <Tr>
                  <Th>Plan</Th>
                  <Th>API access</Th>
                  <Th numeric>Requests / month</Th>
                  <Th numeric>Searches / month</Th>
                </Tr>
              </Thead>
              <Tbody>
                {(Object.keys(PLAN_CONFIG) as (keyof typeof PLAN_CONFIG)[]).map((plan) => (
                  <Tr key={plan}>
                    <Td className="font-medium">{PLAN_CONFIG[plan].label}</Td>
                    <Td>
                      <Badge tone={PLAN_CONFIG[plan].features.api ? "positive" : "neutral"}>
                        {PLAN_CONFIG[plan].features.api ? "Included" : "Not included"}
                      </Badge>
                    </Td>
                    <Td numeric>
                      {PLAN_CONFIG[plan].apiRequestsPerMonth?.toLocaleString() ?? "∞"}
                    </Td>
                    <Td numeric>
                      {PLAN_CONFIG[plan].searchesPerMonth?.toLocaleString() ?? "∞"}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableWrap>
        </Card>

        <ApiReference />
      </PageBody>
    </>
  );
}
