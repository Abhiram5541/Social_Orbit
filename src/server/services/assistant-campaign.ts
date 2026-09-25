import type { SessionUser } from "@/lib/contracts/auth";
import { formatCompact } from "@/lib/format";
import { getCampaign, listCampaigns } from "@/server/repositories/workspace-repository";
import { campaignBenchmark } from "./comparative-service";
import { alertsFor } from "./alert-service";
import { campaignSpend } from "./deal-service";

/* ---------------------------------------------------------------------------
 * The half of the assistant that is about work rather than about creators.
 *
 * A question naming a campaign, a benchmark, or asking what needs attention
 * is answered from the workspace's own records — the same rows the campaign
 * screen draws. Like the creator half, every figure here is computed by this
 * codebase; the model's only job downstream is to put them into a sentence,
 * and the grounding check still rejects any number it adds.
 * ------------------------------------------------------------------------ */

export type AssistantTopic = "campaign" | "benchmark" | "attention" | null;

export interface CampaignContext {
  topic: Exclude<AssistantTopic, null>;
  /** Plain lines the narrator may quote from, and the reader can check. */
  facts: string[];
  /** Where the answer came from, so it can be opened. */
  href: string | null;
}

/**
 * Which campaign the question is about, matched on name. Deliberately literal:
 * guessing "the launch campaign" means the newest one is how an assistant
 * ends up confidently describing the wrong campaign.
 */
function namedCampaign(user: SessionUser, question: string) {
  const asked = question.toLowerCase();
  return (
    listCampaigns(user)
      .filter((campaign) => asked.includes(campaign.name.toLowerCase()))
      // The longest name wins, so "Orbit Series launch" beats "Orbit".
      .sort((a, b) => b.name.length - a.name.length)[0] ?? null
  );
}

export function campaignTopicOf(question: string): AssistantTopic {
  const asked = question.toLowerCase();
  if (/\b(benchmark|compare[d]? to|versus|vs\b|cohort|typical)\b/.test(asked)) return "benchmark";
  if (/\b(attention|needs? (?:me|us|action)|late|overdue|at risk|problem|issue)\b/.test(asked)) {
    return "attention";
  }
  if (/\b(campaign|deliverable|fulfil|attribut|spend|budget|performance)\b/.test(asked)) {
    return "campaign";
  }
  return null;
}

export function campaignContext(
  user: SessionUser,
  question: string,
  topic: Exclude<AssistantTopic, null>,
): CampaignContext | null {
  if (topic === "attention") {
    const alerts = alertsFor(user).filter(
      (alert) => alert.severity === "critical" || alert.severity === "warning",
    );
    if (alerts.length === 0) return null;
    return {
      topic,
      facts: alerts.slice(0, 12).map((alert) => `${alert.title} — ${alert.detail}`),
      href: "/notifications",
    };
  }

  const summary = namedCampaign(user, question);
  if (!summary) return null;
  const campaign = getCampaign(user, summary.id);
  if (!campaign) return null;

  if (topic === "benchmark") {
    const benchmark = campaignBenchmark(user, campaign.id);
    return {
      topic,
      facts: [
        `Campaign: ${campaign.name}`,
        ...benchmark.metrics.map((metric) =>
          metric.cohortMedian === null
            ? `${metric.label}: ${metric.value ?? "not reported"} — no cohort median published (${benchmark.cohortSize} comparable campaigns is too few)`
            : `${metric.label}: ${metric.value ?? "not reported"} against a cohort median of ${metric.cohortMedian} across ${benchmark.cohortSize} campaigns`,
        ),
      ],
      href: `/campaigns/${campaign.id}`,
    };
  }

  const spend = campaignSpend(user, campaign.id);
  const late = campaign.participants.filter(
    (participant) => participant.fulfilment.state === "missed",
  );

  return {
    topic,
    facts: [
      `Campaign: ${campaign.name} (${campaign.status}), ${campaign.startsOn} to ${campaign.endsOn}`,
      `Tracking #${campaign.hashtag}`,
      `Participants: ${campaign.participantCount}, of which ${campaign.confirmedCount} confirmed`,
      `Attributed posts: ${campaign.attributedPosts}`,
      campaign.totalReach === null
        ? "Views: not reported by any platform in this set"
        : `Views: ${formatCompact(campaign.totalReach)}`,
      campaign.totalEngagements === null
        ? "Engagements: not reported"
        : `Engagements: ${formatCompact(campaign.totalEngagements)}`,
      campaign.fulfilmentPercent === null
        ? "Fulfilment: no deliverables defined"
        : `Fulfilment: ${campaign.fulfilmentPercent}%`,
      `Committed: ${spend.currency} ${spend.committed}; paid ${spend.currency} ${spend.paid}`,
      late.length === 0
        ? "No participant is overdue"
        : `Overdue: ${late.map((participant) => participant.displayName).join(", ")}`,
    ],
    href: `/campaigns/${campaign.id}`,
  };
}
