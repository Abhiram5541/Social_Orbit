import type { Metadata } from "next";
import { PLAN_CONFIG } from "@/lib/contracts/auth";
import { formatDate } from "@/lib/format";
import { requirePagePermission } from "@/server/auth/rbac";
import { listOrgs, listUsers } from "@/server/repositories/user-repository";
import { getUsage } from "@/server/repositories/usage-repository";
import { PageBody, PageHeader } from "@/components/shell/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableWrap, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table";

export const metadata: Metadata = { title: "Client organisations" };
export const dynamic = "force-dynamic";

export default async function OrgsPage() {
  await requirePagePermission("admin:orgs", "/admin/orgs");
  const [orgs, users] = await Promise.all([listOrgs(), listUsers()]);

  return (
    <>
      <PageHeader
        title="Organisations"
        description="Tenants on the platform. Every shortlist, campaign, report and API key belongs to exactly one of these; the influencer database is shared."
      />
      <PageBody>
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
                  <Th numeric>Searches used</Th>
                  <Th numeric>Search limit</Th>
                  <Th>Created</Th>
                </Tr>
              </Thead>
              <Tbody>
                {orgs.map((org) => {
                  const plan = PLAN_CONFIG[org.plan];
                  const members = users.filter((user) => user.orgId === org.id).length;
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
                      <Td numeric>{getUsage(org.id, "influencer_search")}</Td>
                      <Td numeric>{plan.searchesPerMonth ?? "∞"}</Td>
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
