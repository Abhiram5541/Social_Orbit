import type { Metadata } from "next";
import { formatDateTime } from "@/lib/format";
import { requirePagePermission } from "@/server/auth/rbac";
import { auditLog } from "@/server/repositories/ops-repository";
import { PageBody, PageHeader } from "@/components/shell/app-shell";
import { Card } from "@/components/ui/card";
import { Table, TableWrap, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table";

export const metadata: Metadata = { title: "Audit log" };
export const dynamic = "force-dynamic";

export default async function AuditPage() {
  await requirePagePermission("admin:audit", "/admin/audit");
  const entries = auditLog(200);

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Sign-ins, role changes, verification decisions, profile edits and API key lifecycle. Append-only."
      />
      <PageBody>
        <Card>
          <TableWrap label="Audit entries">
            <Table>
              <Thead>
                <Tr>
                  <Th>When</Th>
                  <Th>Actor</Th>
                  <Th>Action</Th>
                  <Th>Target</Th>
                  <Th>Detail</Th>
                  <Th>Source IP</Th>
                </Tr>
              </Thead>
              <Tbody>
                {entries.map((entry) => (
                  <Tr key={entry.id}>
                    <Td className="whitespace-nowrap text-ink-muted">{formatDateTime(entry.at)}</Td>
                    <Td className="font-num text-[12px]">{entry.actor}</Td>
                    <Td>
                      <code className="rounded bg-sunken px-1.5 py-0.5 font-num text-[12px] text-brand-ink">
                        {entry.action}
                      </code>
                    </Td>
                    <Td className="font-num text-[12px] text-ink-muted">{entry.target}</Td>
                    <Td>{entry.detail}</Td>
                    <Td className="font-num text-[12px] text-ink-muted">{entry.ip}</Td>
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
