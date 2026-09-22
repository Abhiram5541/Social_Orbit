import type { Metadata } from "next";
import Link from "next/link";
import { Handshake } from "lucide-react";
import { STAGE_LABEL, STAGE_ORDER, type RelationshipStage } from "@/lib/contracts/crm";
import { formatCompact, formatRelativeTime, NO_VALUE } from "@/lib/format";
import { requirePagePermission } from "@/server/auth/rbac";
import { crmTags, listCrm } from "@/server/repositories/crm-repository";
import { PageBody, PageHeader } from "@/components/shell/app-shell";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { Table, TableWrap, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table";
import { ScorePill } from "@/components/intelligence/score";

export const metadata: Metadata = { title: "Relationships" };
export const dynamic = "force-dynamic";

/** Stages that mean the relationship is live rather than closed. */
const OPEN_STAGES: RelationshipStage[] = [
  "prospect",
  "contacted",
  "replied",
  "negotiating",
  "contracted",
  "active",
];

export default async function RelationshipsPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string; tag?: string; q?: string }>;
}) {
  const user = await requirePagePermission("crm:read", "/relationships");
  const { stage, tag, q } = await searchParams;
  const parsed = STAGE_ORDER.find((entry) => entry === stage);

  const all = listCrm(user);
  const records = listCrm(user, { stage: parsed, tag, q });
  const tags = crmTags(user);
  const byStage = new Map<RelationshipStage, number>();
  for (const record of all) byStage.set(record.stage, (byStage.get(record.stage) ?? 0) + 1);

  const href = (next: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({ stage, tag, q, ...next })) {
      if (value) params.set(key, value);
    }
    const query = params.toString();
    return query ? `/relationships?${query}` : "/relationships";
  };

  return (
    <>
      <PageHeader
        eyebrow="Activate"
        title="Relationships"
        description="Your organisation's record of each creator: who owns them, how to reach them, what stage the conversation is at and everything that has happened. The creator index is shared; this is yours alone."
      />
      <PageBody className="space-y-4">
        {/* The pipeline doubles as the filter: a count that cannot be clicked
            is a number you have to act on somewhere else. */}
        <Card>
          <div className="flex flex-wrap gap-2 px-4 py-3">
            <Link
              href={href({ stage: undefined })}
              className={`press rounded-full px-3 py-1.5 text-sm font-medium ${
                parsed === undefined ? "bg-brand text-white" : "bg-sunken text-ink-muted hover:text-ink"
              }`}
            >
              All <span className="font-num">{all.length}</span>
            </Link>
            {STAGE_ORDER.filter((entry) => OPEN_STAGES.includes(entry) || byStage.get(entry)).map(
              (entry) => (
                <Link
                  key={entry}
                  href={href({ stage: entry })}
                  className={`press rounded-full px-3 py-1.5 text-sm font-medium ${
                    parsed === entry ? "bg-brand text-white" : "bg-sunken text-ink-muted hover:text-ink"
                  }`}
                >
                  {STAGE_LABEL[entry]}{" "}
                  <span className="font-num">{byStage.get(entry) ?? 0}</span>
                </Link>
              ),
            )}
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-t border-rule px-4 py-2.5">
              <span className="label-caps-sm text-ink-subtle">Tags</span>
              {tags.map((entry) => (
                <Link
                  key={entry}
                  href={href({ tag: tag === entry ? undefined : entry })}
                  className={`press rounded-full px-2.5 py-1 text-sm ${
                    tag === entry ? "bg-brand-soft text-brand-ink" : "bg-sunken text-ink-muted hover:text-ink"
                  }`}
                >
                  {entry}
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Creators</CardTitle>
            <span className="text-sm text-ink-muted">
              {records.length} of {all.length}
            </span>
          </CardHeader>
          {records.length === 0 ? (
            <EmptyState
              icon={Handshake}
              title={all.length === 0 ? "No relationships yet" : "Nothing matches that filter"}
              description={
                all.length === 0
                  ? "Open a creator from discovery and their relationship record starts there — stage, owner, contact details and a timeline of everything that happens."
                  : "Clear the stage or tag filter to see the rest."
              }
            />
          ) : (
            <TableWrap label="Creator relationships">
              <Table>
                <Thead>
                  <Tr>
                    <Th>Creator</Th>
                    <Th>Stage</Th>
                    <Th>Owner</Th>
                    <Th>Tags</Th>
                    <Th numeric>Followers</Th>
                    <Th numeric>Health</Th>
                    <Th numeric>Relationship</Th>
                    <Th>Last activity</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {records.map((record) => (
                    <Tr key={record.id}>
                      <Td>
                        <Link
                          href={`/influencers/${record.influencerId}`}
                          className="flex min-w-0 items-center gap-2.5"
                          prefetch={false}
                        >
                          <Avatar name={record.displayName} src={record.avatarUrl} size="sm" />
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-ink">
                              {record.displayName}
                            </span>
                            <span className="block truncate font-num text-sm text-ink-muted">
                              @{record.primaryHandle}
                            </span>
                          </span>
                        </Link>
                      </Td>
                      <Td>
                        <Badge tone={record.stage === "blocked" || record.stage === "declined" ? "critical" : record.stage === "active" ? "positive" : "neutral"}>
                          {STAGE_LABEL[record.stage]}
                        </Badge>
                      </Td>
                      <Td className="whitespace-nowrap text-ink-muted">
                        {record.ownerName ?? NO_VALUE}
                      </Td>
                      <Td>
                        {record.tags.length === 0 ? (
                          <span className="text-ink-subtle">{NO_VALUE}</span>
                        ) : (
                          <span className="flex flex-wrap gap-1">
                            {record.tags.slice(0, 3).map((entry) => (
                              <Badge key={entry} tone="neutral">
                                {entry}
                              </Badge>
                            ))}
                          </span>
                        )}
                      </Td>
                      <Td numeric>{formatCompact(record.followers)}</Td>
                      <Td numeric>
                        <ScorePill value={record.healthScore} label="SENSO Health" />
                      </Td>
                      <Td numeric>
                        {/* Null until something has been measured — a creator
                            nobody has worked with is unmeasured, not poor. */}
                        <ScorePill value={record.relationship.value} label="Relationship" />
                      </Td>
                      <Td className="whitespace-nowrap text-ink-muted">
                        {formatRelativeTime(record.lastInteractionAt)}
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableWrap>
          )}
        </Card>
      </PageBody>
    </>
  );
}
