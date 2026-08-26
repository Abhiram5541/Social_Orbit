import type { Metadata } from "next";
import { CATEGORY_LABEL, type Category } from "@/lib/contracts/common";
import { FOLLOWER_BANDS, type FollowerBand } from "@/lib/contracts/search";
import { formatCompact, formatPercent, NO_VALUE } from "@/lib/format";
import { requirePagePermission } from "@/server/auth/rbac";
import { allSummaries } from "@/server/repositories/influencer-repository";
import { median } from "@/server/analytics/metrics";
import { PageBody, PageHeader } from "@/components/shell/app-shell";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/states";
import { Table, TableWrap, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table";

export const metadata: Metadata = { title: "Benchmarks" };
export const dynamic = "force-dynamic";

/** Cohorts below this size do not produce a published benchmark. */
const MIN_COHORT = 8;

function bandOf(followers: number | null): FollowerBand {
  if (followers === null) return "nano";
  for (const band of ["nano", "micro", "mid", "macro"] as const) {
    const { max } = FOLLOWER_BANDS[band];
    if (max !== null && followers < max) return band;
  }
  return "mega";
}

export default async function BenchmarksPage() {
  await requirePagePermission("analytics:benchmarks", "/admin/benchmarks");
  const summaries = allSummaries();

  const cohorts = new Map<
    string,
    { category: Category; band: FollowerBand; engagement: number[]; medianViews: number[]; health: number[] }
  >();

  for (const summary of summaries) {
    const category = summary.categories[0];
    const band = bandOf(summary.followers);
    const key = `${category}:${band}`;
    const cohort =
      cohorts.get(key) ?? { category, band, engagement: [], medianViews: [], health: [] };
    if (summary.engagementRate !== null) cohort.engagement.push(summary.engagementRate);
    if (summary.medianViews !== null) cohort.medianViews.push(summary.medianViews);
    if (summary.healthScore !== null) cohort.health.push(summary.healthScore);
    cohorts.set(key, cohort);
  }

  const rows = [...cohorts.values()]
    .map((cohort) => ({
      ...cohort,
      size: cohort.health.length,
      engagementMedian: median(cohort.engagement),
      viewsMedian: median(cohort.medianViews),
      healthMedian: median(cohort.health),
    }))
    .sort((a, b) => b.size - a.size);

  const publishable = rows.filter((row) => row.size >= MIN_COHORT);

  return (
    <>
      <PageHeader
        title="Category benchmarks"
        description="Cohort medians by category and follower band. These are what engagement and activity scores are normalised against."
      />
      <PageBody className="space-y-4">
        <Notice tone="info" title={`Cohorts under ${MIN_COHORT} creators are not published`}>
          A percentile computed against two or three accounts is noise wearing the costume of
          a statistic — and it would be the most quotable number on a profile. Those cohorts
          are listed below but marked unpublished, and the profiles in them show no rank.
        </Notice>

        <Card>
          <TableWrap label="Category benchmarks">
            <Table>
              <Thead>
                <Tr>
                  <Th>Category</Th>
                  <Th>Follower band</Th>
                  <Th numeric>Creators</Th>
                  <Th numeric>Median engagement</Th>
                  <Th numeric>Median views</Th>
                  <Th numeric>Median health</Th>
                  <Th>Published</Th>
                </Tr>
              </Thead>
              <Tbody>
                {rows.map((row) => (
                  <Tr key={`${row.category}:${row.band}`}>
                    <Td className="font-medium">{CATEGORY_LABEL[row.category]}</Td>
                    <Td className="whitespace-nowrap text-ink-muted">
                      {FOLLOWER_BANDS[row.band].label}
                    </Td>
                    <Td numeric>{row.size}</Td>
                    <Td numeric>{formatPercent(row.engagementMedian)}</Td>
                    <Td numeric>{formatCompact(row.viewsMedian)}</Td>
                    <Td numeric>
                      {row.healthMedian === null ? NO_VALUE : row.healthMedian.toFixed(1)}
                    </Td>
                    <Td className={row.size >= MIN_COHORT ? "text-positive" : "text-ink-subtle"}>
                      {row.size >= MIN_COHORT ? "Yes" : `Needs ${MIN_COHORT - row.size} more`}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableWrap>
        </Card>

        <p className="text-[12px] text-ink-muted">
          {publishable.length} of {rows.length} cohorts currently meet the publication
          threshold.
        </p>
      </PageBody>
    </>
  );
}
