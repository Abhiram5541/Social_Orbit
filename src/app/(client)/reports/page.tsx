import type { Metadata } from "next";
import { requirePagePermission } from "@/server/auth/rbac";
import { listCampaigns, listShortlists } from "@/server/repositories/workspace-repository";
import { listBrands } from "@/server/services/agency-service";
import { listReports, listSchedules } from "@/server/services/report-service";
import { ReportArchive } from "@/components/reports/report-archive";
import { PageBody, PageHeader } from "@/components/shell/app-shell";
import { LinkButton } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Notice } from "@/components/ui/states";

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
  const reports = listReports(user);
  const schedules = listSchedules(user);
  const brands = listBrands(user);

  return (
    <>
      <PageHeader
        eyebrow="Activate"
        title="Reports"
        description="Export what SENSO holds, with the provenance intact — every figure states whether it was verified, observed, derived, estimated or AI-inferred. A number that leaves the platform without that context is a number someone will eventually misquote."
      />
      <PageBody className="space-y-4">
        <Notice tone="info" title="A report is a snapshot, not a live view">
          Generating one freezes the figures as they stand, so a link sent today still shows
          what was sent when it is opened next month. <strong>Export CSV</strong> from a
          creator, shortlist or campaign downloads the rows as that screen shows them, and
          <strong> Save as PDF</strong> prints the screen through your browser with the
          provenance labels intact.
        </Notice>

        <ReportArchive
          reports={reports.map((report) => ({
            id: report.id,
            name: report.name,
            kind: report.kind,
            token: report.token,
            publicLink: report.publicLink,
            generatedAt: report.generatedAt,
            scheduleId: report.scheduleId,
          }))}
          schedules={schedules.map((schedule) => ({
            id: schedule.id,
            name: schedule.name,
            kind: schedule.kind,
            cadence: schedule.cadence,
            nextRunAt: schedule.nextRunAt,
            lastRunAt: schedule.lastRunAt,
            enabled: schedule.enabled,
            recipients: schedule.recipients,
          }))}
          subjects={[
            ...campaigns.map((campaign) => ({
              id: campaign.id,
              name: campaign.name,
              kind: "campaign" as const,
            })),
            ...shortlists.map((shortlist) => ({
              id: shortlist.id,
              name: shortlist.name,
              kind: "shortlist" as const,
            })),
          ]}
          brands={brands.map((brand) => ({ id: brand.id, name: brand.name }))}
        />

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

      </PageBody>
    </>
  );
}
