import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatRelativeTime } from "@/lib/format";
import type { ReviewItem } from "@/server/repositories/ops-repository";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { Table, TableWrap, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table";

const SEVERITY: Record<ReviewItem["severity"], string> = {
  info: "bg-ink-subtle",
  warning: "bg-caution",
  critical: "bg-critical",
};

/** Shared shape for every human-review queue in the admin workspace. */
export function ReviewTable({
  items,
  emptyTitle,
  emptyDescription,
}: {
  items: ReviewItem[];
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (items.length === 0) {
    return (
      <Card>
        <EmptyState title={emptyTitle} description={emptyDescription} />
      </Card>
    );
  }

  return (
    <Card>
      <TableWrap label="Review queue">
        <Table>
          <Thead>
            <Tr>
              <Th>Creator</Th>
              <Th>Reason</Th>
              <Th>What needs a decision</Th>
              <Th>Observed</Th>
            </Tr>
          </Thead>
          <Tbody>
            {items.map((item) => (
              <Tr key={`${item.influencerId}-${item.reason}`}>
                <Td>
                  <Link
                    href={`/influencers/${item.influencerId}`}
                    className="rounded font-medium text-ink hover:text-brand-ink hover:underline"
                  >
                    {item.displayName}
                  </Link>
                  <span className="block font-num text-[12px] text-ink-muted">
                    @{item.handle}
                  </span>
                </Td>
                <Td>
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className={cn("size-1.5 rounded-full", SEVERITY[item.severity])}
                      aria-hidden
                    />
                    {item.reason}
                  </span>
                </Td>
                <Td className="max-w-lg text-ink-muted">{item.detail}</Td>
                <Td className="whitespace-nowrap text-ink-muted">
                  {formatRelativeTime(item.observedAt)}
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </TableWrap>
    </Card>
  );
}
