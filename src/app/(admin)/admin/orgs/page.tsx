import type { Metadata } from "next";
import { PLAN_CONFIG } from "@/lib/contracts/auth";
import { formatDate, NO_VALUE } from "@/lib/format";
import { requirePagePermission } from "@/server/auth/rbac";
import { listOrgs, listUsers } from "@/server/repositories/user-repository";
import { getUsage } from "@/server/repositories/usage-repository";
import { listChanges } from "@/server/services/billing-service";
import { PageBody, PageHeader } from "@/components/shell/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PlanRequests } from "@/components/admin/plan-requests";
import { Table, TableWrap, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table";

export const metadata: Metadata = { title: "Client organisations" };
export const dynamic = "force-dynamic";

export default async function OrgsPage() {
  await requirePagePermission("admin:orgs", "/admin/orgs");
  const [orgs, users] = await Promise.all([listOrgs(), listUsers()]);
  const requests = listChanges()
    .filter((change) => change.status === "pending")
    .map((change) => ({
      id: change.id,
      orgName: orgs.find((org) => org.id === change.orgId)?.name ?? change.orgId,
      fromPlan: change.fromPlan,
      toPlan: change.toPlan,
      requestedByName: change.requestedByName,
      requestedByEmail: change.requestedByEmail,
      note: change.note,
      createdAt: change.createdAt,
    }));

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Organisations"
        description="Tenants on the platform. Every shortlist, campaign, report and API key belongs to exactly one of these; the influencer database is shared."
      />
      <PageBody className="space-y-4">
        <PlanRequests requests={requests} />
        <Card>
          <TableWrap label="Organisations">
            <Table>
              <Thead>
                <Tr>
                  <Th>Organisation</Th>
                  <Th>Kind</Th>
                  <Th>Plan</Th>
                  <Th numeric>Members</Th>
                  <Th numeric>Seats</Th>
                  <Th numeric>Search usage</Th>
                  <Th>Created</Th>
                </Tr>
              </Thead>
              <Tbody>
                {orgs.map((org) => {
                  const plan = PLAN_CONFIG[org.plan];
                  const members = users.filter((user) => user.orgId === org.id).length;
                  const used = getUsage(org.id, "influencer_search");
                  const limit = plan.searchesPerMonth;
                  // The ratio is the fact an operator scans for; the threshold
                  // is the only reason the column exists.
                  const nearLimit = typeof limit === "number" && limit > 0 && used / limit >= 0.8;
                  return (
                    <Tr key={org.id}>
                      <Td className="font-medium">{org.name}</Td>
                      <Td>
                        <Badge tone={org.kind === "platform" ? "brand" : "neutral"}>
                          {org.kind}
                        </Badge>
                      </Td>
                      <Td>{plan.label}</Td>
                      <Td numeric>{members}</Td>
                      <Td numeric>{plan.seats ?? "∞"}</Td>
                      <Td numeric>
                        <span className={nearLimit ? "text-caution" : undefined}>
                          {used} / {typeof limit === "number" ? limit.toLocaleString() : NO_VALUE}
                        </span>
                      </Td>
                      <Td className="whitespace-nowrap text-ink-muted">
                        {formatDate(org.createdAt)}
                      </Td>
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>
          </TableWrap>
        </Card>
      </PageBody>
    </>
  );
}
