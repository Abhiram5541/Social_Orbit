import type { Metadata } from "next";
import { BadgeCheck, KeyRound, Link2, ShieldQuestion } from "lucide-react";
import { pluralise } from "@/lib/format";
import { requirePagePermission } from "@/server/auth/rbac";
import { allSummaries } from "@/server/repositories/influencer-repository";
import {
  conflictQueue,
  reauthQueue,
  verificationQueue,
} from "@/server/repositories/ops-repository";
import { PageBand, PageBody, PageHeader } from "@/components/shell/app-shell";
import {
  Instrument,
  Panel,
  PanelBody,
  PanelHead,
  PanelTitle,
} from "@/components/ui/panel";
import { CompositionBar } from "@/components/charts/distribution-bars";
import { ReviewTable } from "@/components/admin/review-table";
import { HeroSignal, Metric, MetricStrip } from "@/components/intelligence/signal";

export const metadata: Metadata = { title: "Verification" };
export const dynamic = "force-dynamic";

/**
 * The states a creator's identity can be in, in the order the pipeline moves
 * through them. Stated on the page because "unverified" is the honest default
 * for a database built from public APIs, and a reader needs to know that is a
 * position on a scale rather than a failure.
 */
const STAGES = [
  {
    icon: Link2,
    title: "Not connected",
    detail:
      "Built from official platform APIs. Figures are observed, but nobody has proved they own the account.",
  },
  {
    icon: KeyRound,
    title: "OAuth consent",
    detail:
      "The creator authorised SocialOrbit against their own account. First-party analytics become readable.",
  },
  {
    icon: ShieldQuestion,
    title: "Identity match",
    detail:
      "The connected platform identity is checked against the claimed profile. A mismatch stops here.",
  },
  {
    icon: BadgeCheck,
    title: "SocialOrbit Verified",
    detail:
      "Issued only after a successful match. Public data can never produce this status.",
  },
];

export default async function Page() {
  await requirePagePermission("verification:review", "/admin/verification");

  const summaries = allSummaries();
  const pending = verificationQueue();
  const reauth = reauthQueue();
  const conflicts = conflictQueue();

  const verified = summaries.filter((s) => s.verification === "verified").length;
  const connected = summaries.filter((s) => s.verification === "pending").length;
  const unverified = summaries.filter((s) => s.verification === "unverified").length;
  const coverage = summaries.length > 0 ? (verified / summaries.length) * 100 : null;

  const queued = pending.length + reauth.length + conflicts.length;

  return (
    <>
      <PageHeader
        eyebrow="Trust & data"
        title="Verification"
        description="Verified status is issued only after a creator connects an account over OAuth and the connected identity matches the claimed profile. It is never inferred from public data."
      />

      <Instrument className="py-8">
        <HeroSignal tone="instrument"
          eyebrow="Identity coverage · share of indexed creators verified"
          value={coverage}
          // Rounding 0.63 to "1" would overstate coverage by half — the one
          // number on this page nobody may round in the platform's favour.
          display={coverage === null ? undefined : `${coverage.toFixed(coverage < 10 ? 1 : 0)}`}
          suffix="%"
          scale={[0, 100]}
          band={queued > 0 ? `${pluralise(queued, "item")} waiting` : "Queue clear"}
          bandTone={queued > 0 ? "caution" : "positive"}
          explanation={
            verified === 0
              ? "No creator in the database has connected an account yet. Every figure here is observed from an official API — accurate, but unattested. Verification is a creator-initiated action, so this number only moves when creators opt in."
              : `${verified} of ${summaries.length.toLocaleString()} indexed creators have proved they own their account. The rest are observed from official APIs: their figures are real, but nobody has attested to them.`
          }
          aside={
            <div>
              <p className="label-caps-sm mb-2 text-instrument-muted">Identity states</p>
              <CompositionBar
                onInstrument
                segments={[
                  { label: "Verified", value: verified, tone: "brand" },
                  { label: "Connected, awaiting match", value: connected, tone: "caution" },
                  { label: "Not connected", value: unverified, tone: "neutral" },
                ]}
              />
            </div>
          }
        />
      </Instrument>

      <PageBand inset={false}>
        <MetricStrip>
          <Metric
            label="Verified"
            value={verified}
            tone="lead"
            footnote="OAuth + identity match"
          />
          <Metric
            label="Awaiting match"
            value={pending.length}
            footnote="consent given, checks pending"
          />
          <Metric
            label="Reauthorisation"
            value={reauth.length}
            footnote="stored token needs re-consent"
          />
          <Metric
            label="Source conflicts"
            value={conflicts.length}
            footnote="two sources disagree"
          />
          <Metric
            label="Not connected"
            value={unverified}
            tone="muted"
            footnote="observed from public APIs"
          />
        </MetricStrip>
      </PageBand>

      <PageBody className="space-y-5">
        <ReviewTable
          items={pending}
          title="Awaiting identity match"
          emptyTitle="No creator is waiting on a match"
          emptyDescription="Every connected account has been matched or rejected."
          watchList={[
            "OAuth consent completed",
            "Handle and display name agreement",
            "Account age and ownership signals",
            "Cross-platform identity linkage",
          ]}
          actionLabel="Review match"
        />

        {reauth.length > 0 && (
          <ReviewTable
            items={reauth}
            title="Reauthorisation required"
            emptyTitle="No account needs re-consent"
            emptyDescription="Every stored token is valid."
            actionLabel="Open profile"
          />
        )}

        {conflicts.length > 0 && (
          <ReviewTable
            items={conflicts}
            title="Source conflicts"
            emptyTitle="No conflicting sources"
            emptyDescription="No field has two sources disagreeing."
            actionLabel="Resolve"
          />
        )}

        <Panel>
          <PanelHead>
            <PanelTitle>How a creator becomes verified</PanelTitle>
            <span className="text-sm text-ink-muted">
              A status ladder, not a switch
            </span>
          </PanelHead>
          <PanelBody className="p-0">
            <ol className="grid divide-y divide-rule md:grid-cols-4 md:divide-x md:divide-y-0">
              {STAGES.map((stage, index) => (
                <li key={stage.title} className="min-w-0 p-4">
                  <div className="flex items-center gap-2">
                    <stage.icon
                      className={
                        index === STAGES.length - 1
                          ? "size-4 text-brand"
                          : "size-4 text-ink-subtle"
                      }
                      aria-hidden
                    />
                    <span className="label-caps-sm text-ink-subtle">
                      Stage {index + 1}
                    </span>
                  </div>
                  <p className="mt-1.5 text-base font-medium text-ink">{stage.title}</p>
                  <p className="mt-0.5 text-sm text-ink-muted">{stage.detail}</p>
                </li>
              ))}
            </ol>
          </PanelBody>
        </Panel>
      </PageBody>
    </>
  );
}
