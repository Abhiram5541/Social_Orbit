import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { requirePagePermission } from "@/server/auth/rbac";
import { listCampaigns, listShortlists } from "@/server/repositories/workspace-repository";
import { PageBody, PageHeader } from "@/components/shell/app-shell";
import { LinkButton } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, Notice } from "@/components/ui/states";

export const metadata: Metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

interface ReportType {
  id: string;
  /** What the report is drawn from — the ledger's kind tag. */
  source: string;
  title: string;
  detail: string;
  /** Where you start this report today. */
  start: { href: string; label: string };
  /** True once export works from that starting point. */
  available: boolean;
  unavailableNote?: string;
}

const REPORT_TYPES: ReportType[] = [
  {
    id: "influencer",
    source: "Creator",
    title: "Influencer report",
    detail:
      "Account, audience and content performance for one creator, with score components, evidence and provenance.",
    start: { href: "/discovery", label: "Pick a creator" },
    available: true,
  },
  {
    id: "comparison",
    source: "Shortlist",
    title: "Comparison report",
    detail:
      "Two to five creators on normalised metrics, with incomparable measures flagged rather than silently averaged.",
    start: { href: "/shortlists", label: "Open a shortlist" },
    available: true,
  },
  {
    id: "campaign",
    source: "Campaign",
    title: "Campaign performance report",
    detail:
      "Attributed posts, per-creator campaign scores, reach, engagement and cost efficiency for one campaign.",
    start: { href: "/campaigns", label: "Open a campaign" },
    available: true,
  },
  {
    id: "audience",
    source: "Audience",
    title: "Audience report",
    detail:
      "Demographics and audience quality for creators who have authorised first-party access.",
    start: { href: "/discovery?verification=verified", label: "Find verified creators" },
    available: false,
    unavailableNote:
      "Audience exports are held back until first-party connections are live — there is nothing authorised to export yet.",
  },
];

export default async function ReportsPage() {
  const user = await requirePagePermission("report:read", "/reports");
  const campaigns = listCampaigns(user);
  const shortlists = listShortlists(user);

  return (
    <>
      <PageHeader
        eyebrow="Activate"
        title="Reports"
        description="Export what SocialOrbit holds, with the provenance intact — every figure states whether it was verified, observed, derived, estimated or AI-inferred. A number that leaves the platform without that context is a number someone will eventually misquote."
      />
      <PageBody className="space-y-4">
        <Notice tone="caution" title="Exports run from the record, not from here">
          Open a creator, a shortlist or a campaign and export it from there. Scheduled
          generation, PDF rendering and a report archive are not built yet, so this page does
          not pretend to offer them.
        </Notice>

        <Card>
          <CardHeader>
            <CardTitle>Report types</CardTitle>
          </CardHeader>
          <ul className="divide-y divide-line">
            {REPORT_TYPES.map((report) => (
              <li
                key={report.id}
                className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3"
              >
                <span className="label-caps w-20 shrink-0 pt-0.5 text-ink-subtle">
                  {report.source}
                </span>
                <div className="min-w-0 flex-1 basis-56">
                  <p className="font-medium text-ink">{report.title}</p>
                  <p className="mt-0.5 text-sm text-ink-muted">{report.detail}</p>
                </div>
                {report.available ? (
                  <LinkButton href={report.start.href} size="sm" className="shrink-0">
                    {report.start.label}
                  </LinkButton>
                ) : (
                  <div className="w-full sm:w-60 sm:shrink-0 sm:text-right">
                    <span className="label-caps text-ink-subtle">Not yet available</span>
                    <p className="mt-0.5 text-sm text-ink-subtle">{report.unavailableNote}</p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Generated reports</CardTitle>
          </CardHeader>
          <EmptyState
            icon={FileText}
            title="No reports generated yet"
            description={
              campaigns.length > 0 || shortlists.length > 0
                ? "Generate one from a campaign or a shortlist. It appears here when it is ready to download."
                : "Create a shortlist or a campaign first — a report needs something to report on."
            }
            action={
              campaigns.length > 0 ? (
                <LinkButton href={`/campaigns/${campaigns[0].id}`} size="sm">
                  Open {campaigns[0].name}
                </LinkButton>
              ) : (
                <LinkButton href="/discovery" size="sm">
                  Go to discovery
                </LinkButton>
              )
            }
          />
        </Card>
      </PageBody>
    </>
  );
}
