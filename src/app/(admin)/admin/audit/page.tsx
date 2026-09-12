import * as React from "react";
import type { Metadata } from "next";
import { formatDate, formatDateTime } from "@/lib/format";
import { requirePagePermission } from "@/server/auth/rbac";
import { auditLog } from "@/server/repositories/ops-repository";
import { PageBody, PageHeader } from "@/components/shell/app-shell";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { Table, TableWrap, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table";

export const metadata: Metadata = { title: "Audit log" };
export const dynamic = "force-dynamic";

export default async function AuditPage() {
  await requirePagePermission("admin:audit", "/admin/audit");
  const entries = auditLog(200);

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Audit log"
        description="Sign-ins, role changes, verification decisions, profile edits and API key lifecycle. Append-only."
      />
      <PageBody>
        <Card>
          {entries.length === 0 ? (
            <EmptyState
              title="Nothing recorded yet"
              description="Sign-ins, role changes and verification decisions will appear here as they happen."
            />
          ) : (
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
                  {entries.map((entry, index) => {
                    const day = formatDate(entry.at);
                    const newDay = index === 0 || day !== formatDate(entries[index - 1].at);
                    return (
                      <React.Fragment key={entry.id}>
                        {/* A 200-row log reads by day. Not sticky: the table's
                            scroll-x wrapper is the sticky scrollport and it
                            never scrolls vertically, so sticky here would be
                            dead code. */}
                        {newDay && (
                          <Tr>
                            <Td
                              colSpan={6}
                              className="label-caps bg-sunken py-1.5 text-ink-muted"
                            >
                              {day}
                            </Td>
                          </Tr>
                        )}
                        <Tr>
                          <Td className="whitespace-nowrap font-num text-ink-muted">
                            {formatDateTime(entry.at)}
                          </Td>
                          <Td className="font-num text-sm">{entry.actor}</Td>
                          <Td>
                            <code className="rounded bg-sunken px-1.5 py-0.5 font-num text-sm text-ink">
                              {entry.action}
                            </code>
                          </Td>
                          <Td className="font-num text-sm text-ink-muted">{entry.target}</Td>
                          <Td>{entry.detail}</Td>
                          <Td className="font-num text-sm text-ink-muted">{entry.ip}</Td>
                        </Tr>
                      </React.Fragment>
                    );
                  })}
                </Tbody>
              </Table>
            </TableWrap>
          )}
        </Card>
      </PageBody>
    </>
  );
}
