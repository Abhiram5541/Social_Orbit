import type { Metadata } from "next";
import { formatCompact, formatDate, formatPercent, NO_VALUE } from "@/lib/format";
import { reportByToken } from "@/server/services/report-service";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableWrap, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table";
import { PrintButton } from "@/components/ui/print-button";

export const metadata: Metadata = { title: "Report", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * A shared report, under the client's own branding.
 *
 * Deliberately not inside the application chrome: the recipient is a brand
 * stakeholder who has no SENSO account, and the page is the client's
 * document rather than SENSO's product. The figures are the snapshot taken
 * when the report was generated, and the page says so.
 */
export default async function PublicReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const report = reportByToken(token);

  if (!report) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <h1 className="text-title font-semibold tracking-display text-ink">
          This report link is not valid
        </h1>
        <p className="mt-2 text-base text-ink-muted">
          It may not have been shared, or it may have been replaced by a newer one.
        </p>
      </main>
    );
  }

  const snapshot = report.snapshot as Record<string, never>;
  const campaign = snapshot.campaign as
    | { name: string; hashtag: string; attributedPosts: number; totalViews: number | null; totalEngagements: number | null; fulfilmentPercent: number | null; startsOn: string; endsOn: string }
    | undefined;
  const participants = (snapshot.participants ?? []) as {
    displayName: string; primaryHandle: string; posts: number; views: number | null;
    engagementRate: number | null; campaignScore: number | null;
  }[];
  const creators = (snapshot.creators ?? []) as {
    displayName: string; primaryHandle: string; followers: number | null; healthScore: number | null; engagementRate: number | null;
  }[];

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5">
        <div className="flex items-center gap-3">
          {report.branding.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- client asset
            <img
              src={report.branding.logoUrl}
              alt={`${report.branding.orgName} logo`}
              className="h-10 w-auto max-w-40 rounded-md object-contain"
              referrerPolicy="no-referrer"
            />
          )}
          <div>
            <p className="font-display text-md font-extrabold tracking-wide text-ink">
              {report.branding.orgName}
            </p>
            <p className="text-sm text-ink-muted">{report.name}</p>
          </div>
        </div>
        <PrintButton />
      </header>

      <p className="mt-4 text-sm text-ink-subtle">
        Figures are as they stood when this report was generated on{" "}
        {formatDate(report.generatedAt)}. They are a snapshot, not a live view.
      </p>

      {campaign && (
        <Card className="mt-5">
          <CardHeader>
            <CardTitle>{campaign.name}</CardTitle>
            <span className="flex items-center gap-2 text-sm text-ink-muted">
              <Badge tone="neutral">#{campaign.hashtag}</Badge>
              {formatDate(campaign.startsOn)} – {formatDate(campaign.endsOn)}
            </span>
          </CardHeader>
          <dl className="grid divide-y divide-rule sm:grid-cols-4 sm:divide-x sm:divide-y-0">
            <Figure label="Attributed posts">{campaign.attributedPosts}</Figure>
            <Figure label="Views">{formatCompact(campaign.totalViews)}</Figure>
            <Figure label="Engagements">{formatCompact(campaign.totalEngagements)}</Figure>
            <Figure label="Fulfilment">
              {campaign.fulfilmentPercent === null ? NO_VALUE : `${campaign.fulfilmentPercent}%`}
            </Figure>
          </dl>
        </Card>
      )}

      {participants.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Creator performance</CardTitle>
          </CardHeader>
          <TableWrap label="Creator performance">
            <Table>
              <Thead>
                <Tr>
                  <Th>Creator</Th>
                  <Th numeric>Posts</Th>
                  <Th numeric>Views</Th>
                  <Th numeric>Engagement</Th>
                  <Th numeric>Campaign score</Th>
                </Tr>
              </Thead>
              <Tbody>
                {participants.map((participant) => (
                  <Tr key={participant.primaryHandle}>
                    <Td>
                      {participant.displayName}
                      <span className="block font-num text-sm text-ink-muted">
                        @{participant.primaryHandle}
                      </span>
                    </Td>
                    <Td numeric>{participant.posts}</Td>
                    <Td numeric>{formatCompact(participant.views)}</Td>
                    <Td numeric>{formatPercent(participant.engagementRate)}</Td>
                    <Td numeric>{participant.campaignScore ?? NO_VALUE}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableWrap>
        </Card>
      )}

      {creators.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Creators</CardTitle>
          </CardHeader>
          <TableWrap label="Creators">
            <Table>
              <Thead>
                <Tr>
                  <Th>Creator</Th>
                  <Th numeric>Followers</Th>
                  <Th numeric>SENSO Health</Th>
                  <Th numeric>Engagement</Th>
                </Tr>
              </Thead>
              <Tbody>
                {creators.map((creator) => (
                  <Tr key={creator.primaryHandle}>
                    <Td>
                      {creator.displayName}
                      <span className="block font-num text-sm text-ink-muted">
                        @{creator.primaryHandle}
                      </span>
                    </Td>
                    <Td numeric>{formatCompact(creator.followers)}</Td>
                    <Td numeric>{creator.healthScore ?? NO_VALUE}</Td>
                    <Td numeric>{formatPercent(creator.engagementRate)}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableWrap>
        </Card>
      )}

      <footer className="mt-6 border-t border-line pt-4 text-sm text-ink-subtle">
        Measured by SENSO. Every figure states whether it was observed, derived or
        estimated inside the platform; this summary carries the same numbers.
      </footer>
    </main>
  );
}

function Figure({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3">
      <dt className="label-caps-sm text-ink-subtle">{label}</dt>
      <dd className="mt-0.5 font-num text-stat font-semibold text-ink">{children}</dd>
    </div>
  );
}
