import type { Metadata } from "next";
import { PLAN_CONFIG, ROLE_LABEL, ROLE_PERMISSIONS } from "@/lib/contracts/auth";
import { formatRelativeTime } from "@/lib/format";
import { requirePagePermission } from "@/server/auth/rbac";
import { listOrgs, listUsers } from "@/server/repositories/user-repository";
import { PageBody, PageHeader } from "@/components/shell/app-shell";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableWrap, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table";

export const metadata: Metadata = { title: "Users" };
export const dynamic = "force-dynamic";

export default async function UsersPage() {
  await requirePagePermission("admin:users", "/admin/users");
  const [users, orgs] = await Promise.all([listUsers(), listOrgs()]);
  const orgById = new Map(orgs.map((org) => [org.id, org]));

  return (
    <>
      <PageHeader
        title="Users"
        description="Every account, its role and the organisation it belongs to. Permissions are derived from the role, never assigned per user."
      />
      <PageBody className="space-y-4">
        <Card>
          <TableWrap label="Users">
            <Table>
              <Thead>
                <Tr>
                  <Th>User</Th>
                  <Th>Role</Th>
                  <Th>Organisation</Th>
                  <Th>Plan</Th>
                  <Th numeric>Permissions</Th>
                  <Th>Last sign-in</Th>
                  <Th>Status</Th>
                </Tr>
              </Thead>
              <Tbody>
                {users.map((user) => {
                  const org = orgById.get(user.orgId);
                  return (
                    <Tr key={user.id}>
                      <Td>
                        <div className="flex items-center gap-2.5">
                          <Avatar name={user.name} src={user.avatarUrl} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-ink">{user.name}</p>
                            <p className="truncate font-num text-[12px] text-ink-muted">
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <Badge tone={user.role === "super_admin" ? "brand" : "neutral"}>
                          {ROLE_LABEL[user.role]}
                        </Badge>
                      </Td>
                      <Td>
                        {org?.name ?? user.orgId}
                        <span className="block text-[12px] text-ink-muted">{org?.kind}</span>
                      </Td>
                      <Td>{org ? PLAN_CONFIG[org.plan].label : "—"}</Td>
                      <Td numeric>{ROLE_PERMISSIONS[user.role].length}</Td>
                      <Td className="whitespace-nowrap text-ink-muted">
                        {formatRelativeTime(user.lastLoginAt)}
                      </Td>
                      <Td>
                        <Badge tone={user.status === "active" ? "positive" : "critical"} dot>
                          {user.status}
                        </Badge>
                      </Td>
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>
          </TableWrap>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Role permissions</CardTitle>
            <span className="text-[12px] text-ink-muted">
              Enforced server-side on every route. Hiding UI is never the control.
            </span>
          </CardHeader>
          <TableWrap label="Role permission matrix">
            <Table>
              <Thead>
                <Tr>
                  <Th>Role</Th>
                  <Th numeric>Permissions</Th>
                  <Th>Grants</Th>
                </Tr>
              </Thead>
              <Tbody>
                {(Object.keys(ROLE_PERMISSIONS) as (keyof typeof ROLE_PERMISSIONS)[]).map((role) => (
                  <Tr key={role}>
                    <Td className="whitespace-nowrap font-medium">{ROLE_LABEL[role]}</Td>
                    <Td numeric>{ROLE_PERMISSIONS[role].length}</Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {ROLE_PERMISSIONS[role].map((permission) => (
                          <code
                            key={permission}
                            className="rounded bg-sunken px-1 py-0.5 font-num text-[11px] text-ink-muted"
                          >
                            {permission}
                          </code>
                        ))}
                      </div>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableWrap>
        </Card>
      </PageBody>
    </>
  );
}
