import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { formatDate } from "@/lib/format";
import { requirePagePermission } from "@/server/auth/rbac";
import { listCampaigns, listShortlists } from "@/server/repositories/workspace-repository";
import { PageBody, PageHeader } from "@/components/shell/app-shell";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, Notice } from "@/components/ui/states";

export const metadata: Metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

interface ReportType {
  id: string;
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
    title: "Influencer report",
    detail:
      "Account, audience and content performance for one creator, with score components, evidence and provenance.",
    start: { href: "/discovery", label: "Pick a creator" },
    available: true,
  },
  {
    id: "comparison",
    title: "Comparison report",
    detail:
      "Two to five creators on normalised metrics, with incomparable measures flagged rather than silently averaged.",
    start: { href: "/shortlists", label: "Open a shortlist" },
    available: true,
  },
  {
    id: "campaign",
    title: "Campaign performance report",
    detail:
      "Attributed posts, per-creator campaign scores, reach, engagement and cost efficiency for one campaign.",
    start: { href: "/campaigns", label: "Open a campaign" },
    available: true,
  },
  {
    id: "audience",
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
        title="Reports"
        description="Export what SocialOrbit holds, with the provenance intact. Large reports are generated in the background."
      />
      <PageBody className="space-y-4">
        <Notice tone="info" title="Every export carries its provenance">
          A SocialOrbit export states, for each figure, whether it was verified, observed,
          derived, estimated or AI-inferred. A number that leaves the platform without that
          context is a number someone will eventually misquote.
        </Notice>

        <Notice tone="caution" title="Exports run from the record, not from here">
          Open a creator, a shortlist or a campaign and export it from there. Scheduled
          generation, PDF rendering and a report archive are not built yet, so this page does
          not pretend to offer them.
        </Notice>

        <div className="grid gap-4 md:grid-cols-2">
          {REPORT_TYPES.map((report) => (
            <Card key={report.id}>
              <CardHeader>
                <span className="flex items-center gap-2">
                  <FileText className="size-4 text-ink-subtle" aria-hidden />
                  <CardTitle>{report.title}</CardTitle>
                </span>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-[13px] leading-5 text-ink-muted">{report.detail}</p>
                {report.available ? (
                  <>
                    <LinkButton href={report.start.href} size="sm" variant="primary">
                      {report.start.label}
                    </LinkButton>
                    <p className="text-[12px] text-ink-subtle">
                      Export to CSV from the record itself. Scheduled PDF delivery is not
                      available yet.
                    </p>
                  </>
                ) : (
                  <>
                    <Button size="sm" variant="secondary" disabled>
                      Not available yet
                    </Button>
                    <p className="text-[12px] text-ink-subtle">{report.unavailableNote}</p>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

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

        <p className="text-[12px] text-ink-muted">
          Report history is empty because nothing has been generated in this workspace. Reports
          are retained for 90 days from {formatDate(new Date().toISOString())}.
        </p>
      </PageBody>
    </>
  );
}
