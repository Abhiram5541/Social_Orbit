import type { SessionUser } from "@/lib/contracts/auth";
import { ApiFailure, assertTenantAccess } from "@/server/auth/rbac";
import { appRows, persist } from "@/server/data/app-store";
import { findOrg } from "@/server/repositories/user-repository";
import { brandingFor } from "./agency-service";
import { getCampaign, getShortlist, listCampaigns } from "@/server/repositories/workspace-repository";
import { toSummary } from "@/server/repositories/influencer-repository";
import { campaignSpend } from "./deal-service";
import { enqueue, registerJob } from "./job-queue";
import { sendEmail } from "./notification-service";

/* ---------------------------------------------------------------------------
 * Reports: generated on a schedule, kept in an archive, shareable under a
 * client's own branding.
 *
 * A report is a *snapshot*, not a live view. Once generated it holds the
 * figures as they stood, because a client who received a report last month
 * and opens the link today should see what they were sent — a "report" that
 * silently re-renders from current data is a dashboard with a date printed
 * on it, and the date is then a lie.
 *
 * Every snapshot carries the formula versions that produced it, so a number
 * quoted from an old report can still be traced to how it was calculated.
 * ------------------------------------------------------------------------ */

export const REPORT_VERSION = "report-1.0.0";

export type ReportKind = "campaign" | "shortlist" | "portfolio";
export type Cadence = "once" | "daily" | "weekly" | "monthly";

export interface ReportSchedule {
  id: string;
  orgId: string;
  name: string;
  kind: ReportKind;
  /** Campaign or shortlist id; null for a portfolio report. */
  subjectId: string | null;
  cadence: Cadence;
  /** Agency workflow: the client this report goes out under. */
  brandId?: string | null;
  /** Addresses the finished report is emailed to. */
  recipients: string[];
  /** Whether the share link may be opened without a session. */
  publicLink: boolean;
  nextRunAt: string;
  lastRunAt: string | null;
  enabled: boolean;
  createdAt: string;
  createdByName: string;
}

export interface GeneratedReport {
  id: string;
  orgId: string;
  scheduleId: string | null;
  name: string;
  kind: ReportKind;
  subjectId: string | null;
  brandId?: string | null;
  /** The frozen figures. */
  snapshot: Record<string, unknown>;
  branding: { orgName: string; logoUrl: string | null };
  token: string;
  publicLink: boolean;
  generatedAt: string;
  version: string;
}

const schedules = () => appRows<ReportSchedule>("report_schedules", () => []);
const reports = () => appRows<GeneratedReport>("reports", () => []);

const nextId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const token = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;

function advance(from: Date, cadence: Cadence): Date {
  const next = new Date(from);
  if (cadence === "daily") next.setUTCDate(next.getUTCDate() + 1);
  else if (cadence === "weekly") next.setUTCDate(next.getUTCDate() + 7);
  else if (cadence === "monthly") next.setUTCMonth(next.getUTCMonth() + 1);
  else next.setUTCFullYear(next.getUTCFullYear() + 100); // "once" never recurs
  return next;
}

/* --- Snapshots ---------------------------------------------------------- */

/** Builds the frozen figures for one report. */
export async function buildSnapshot(
  user: SessionUser,
  kind: ReportKind,
  subjectId: string | null,
): Promise<Record<string, unknown>> {
  if (kind === "campaign") {
    if (!subjectId) throw new ApiFailure("validation_failed", "Name the campaign.");
    const campaign = getCampaign(user, subjectId);
    if (!campaign) throw new ApiFailure("not_found", "Campaign not found.");
    return {
      campaign: {
        id: campaign.id,
        name: campaign.name,
        hashtag: campaign.hashtag,
        status: campaign.status,
        startsOn: campaign.startsOn,
        endsOn: campaign.endsOn,
        attributedPosts: campaign.attributedPosts,
        totalViews: campaign.totalReach,
        totalEngagements: campaign.totalEngagements,
        fulfilmentPercent: campaign.fulfilmentPercent,
      },
      spend: campaignSpend(user, subjectId),
      participants: campaign.participants.map((participant) => ({
        displayName: participant.displayName,
        primaryHandle: participant.primaryHandle,
        posts: participant.performance.attributedPosts,
        views: participant.performance.views,
        engagementRate: participant.performance.engagementRate,
        campaignScore: participant.performance.campaignScore,
        fulfilment: participant.fulfilment,
      })),
      attributedContent: campaign.attributedContent.slice(0, 50),
      formulaVersions: {
        campaign: campaign.participants[0]?.performance.formulaVersion ?? null,
        attribution: campaign.participants[0]?.performance.attributionVersion ?? null,
      },
    };
  }

  if (kind === "shortlist") {
    if (!subjectId) throw new ApiFailure("validation_failed", "Name the shortlist.");
    const shortlist = getShortlist(user, subjectId);
    if (!shortlist) throw new ApiFailure("not_found", "Shortlist not found.");
    return {
      shortlist: { id: shortlist.id, name: shortlist.name, itemCount: shortlist.itemCount },
      creators: shortlist.items.map((item) => {
        const summary = toSummary(item.influencerId);
        return {
          displayName: item.displayName,
          primaryHandle: item.primaryHandle,
          followers: item.followers,
          healthScore: item.healthScore,
          engagementRate: item.engagementRate,
          confidence: summary?.confidence ?? null,
          risk: summary?.risk ?? null,
          note: item.note,
        };
      }),
    };
  }

  const campaigns = listCampaigns(user);
  return {
    portfolio: {
      campaigns: campaigns.length,
      attributedPosts: campaigns.reduce((total, campaign) => total + campaign.attributedPosts, 0),
      committed: campaigns.reduce((total, campaign) => total + (campaign.spentAmount ?? 0), 0),
    },
    campaigns: campaigns.map((campaign) => ({
      name: campaign.name,
      status: campaign.status,
      attributedPosts: campaign.attributedPosts,
      totalViews: campaign.totalReach,
      fulfilmentPercent: campaign.fulfilmentPercent,
    })),
  };
}

export async function generateReport(
  user: SessionUser,
  input: {
    name: string;
    kind: ReportKind;
    subjectId: string | null;
    scheduleId?: string | null;
    publicLink?: boolean;
    brandId?: string | null;
  },
): Promise<GeneratedReport> {
  const report: GeneratedReport = {
    id: nextId("rep"),
    orgId: user.orgId,
    scheduleId: input.scheduleId ?? null,
    name: input.name,
    kind: input.kind,
    subjectId: input.subjectId,
    brandId: input.brandId ?? null,
    snapshot: await buildSnapshot(user, input.kind, input.subjectId),
    // The client's own mark travels with the report, so a shared link is
    // theirs rather than SENSO's (D43 applies to what leaves the workspace
    // too) — and inside an agency, the *brand's* mark rather than the
    // agency's, because the stakeholder reading it works for the brand.
    branding: await brandingFor(user.orgId, input.brandId ?? null),
    token: token(),
    publicLink: input.publicLink ?? false,
    generatedAt: new Date().toISOString(),
    version: REPORT_VERSION,
  };
  reports().push(report);
  persist("reports", [report]);
  return report;
}

export function listReports(user: SessionUser, kind?: ReportKind): GeneratedReport[] {
  return reports()
    .filter((report) => report.orgId === user.orgId)
    .filter((report) => !kind || report.kind === kind)
    .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
}

export function reportByToken(value: string): GeneratedReport | null {
  const report = reports().find((entry) => entry.token === value);
  // A link that was never made public is not readable by link, even with the
  // token: sharing is a decision, not an accident of knowing the URL.
  return report && report.publicLink ? report : null;
}

/* --- Schedules ---------------------------------------------------------- */

export function listSchedules(user: SessionUser): ReportSchedule[] {
  return schedules()
    .filter((row) => row.orgId === user.orgId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function createSchedule(
  user: SessionUser,
  input: {
    name: string;
    kind: ReportKind;
    subjectId: string | null;
    cadence: Cadence;
    recipients: string[];
    publicLink?: boolean;
    brandId?: string | null;
  },
): ReportSchedule {
  const now = new Date();
  const row: ReportSchedule = {
    id: nextId("sch"),
    orgId: user.orgId,
    name: input.name,
    kind: input.kind,
    subjectId: input.subjectId,
    cadence: input.cadence,
    brandId: input.brandId ?? null,
    recipients: [...new Set(input.recipients.map((address) => address.trim().toLowerCase()))],
    publicLink: input.publicLink ?? false,
    nextRunAt: now.toISOString(),
    lastRunAt: null,
    enabled: true,
    createdAt: now.toISOString(),
    createdByName: user.name,
  };
  schedules().push(row);
  persist("report_schedules", [row]);
  // Queued rather than run inline: a report over a large campaign should not
  // sit inside the request that asked for it.
  enqueue("report.run", { scheduleId: row.id }, { orgId: user.orgId });
  return row;
}

export function setScheduleEnabled(user: SessionUser, id: string, enabled: boolean): ReportSchedule {
  const row = schedules().find((entry) => entry.id === id);
  if (!row) throw new ApiFailure("not_found", "Schedule not found.");
  assertTenantAccess(user, row.orgId);
  row.enabled = enabled;
  persist("report_schedules", [row]);
  return row;
}

/** Queues every schedule that is due. Called by the daily clock. */
export function queueDueReports(now = new Date()): number {
  let queued = 0;
  for (const row of schedules()) {
    if (!row.enabled || row.nextRunAt > now.toISOString()) continue;
    enqueue("report.run", { scheduleId: row.id }, { orgId: row.orgId });
    queued += 1;
  }
  return queued;
}

/* --- The job ------------------------------------------------------------ */

registerJob("report.run", async (job) => {
  const scheduleId = String(job.payload.scheduleId ?? "");
  const row = schedules().find((entry) => entry.id === scheduleId);
  if (!row) throw new Error(`Schedule ${scheduleId} no longer exists.`);

  const org = await findOrg(row.orgId);
  // A schedule runs as the organisation, not as the person who made it: that
  // person may have left, and the report is the organisation's.
  const asOrg: SessionUser = {
    id: "system",
    email: "system@senso360.com",
    name: row.createdByName,
    avatarUrl: null,
    role: "client_owner",
    orgId: row.orgId,
    orgName: org?.name ?? "",
    orgKind: org?.kind ?? "client",
    plan: org?.plan ?? "free",
    orgLogoUrl: org?.logoUrl ?? null,
    influencerId: null,
  };

  const report = await generateReport(asOrg, {
    name: row.name,
    kind: row.kind,
    subjectId: row.subjectId,
    scheduleId: row.id,
    publicLink: row.publicLink,
    brandId: row.brandId ?? null,
  });

  row.lastRunAt = new Date().toISOString();
  row.nextRunAt = advance(new Date(), row.cadence).toISOString();
  persist("report_schedules", [row]);

  let emailed = 0;
  if (row.recipients.length > 0) {
    const origin = process.env.APP_URL?.replace(/\/$/, "") ?? "";
    for (const to of row.recipients) {
      const sent = await sendEmail({
        to,
        subject: `${report.branding.orgName}: ${row.name}`,
        html: `<p>${row.name} is ready.</p><p><a href="${origin}/report/${report.token}">Open the report</a></p><p style="color:#8a8399;font-size:12px">Figures are as they stood at ${report.generatedAt}.</p>`,
      });
      if (sent) emailed += 1;
    }
  }

  return { reportId: report.id, emailed, recipients: row.recipients.length };
});
