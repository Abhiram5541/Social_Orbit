import * as React from "react";
import { Sparkles } from "lucide-react";
import type { InfluencerProfile } from "@/lib/contracts/influencer";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, Eyebrow } from "@/components/ui/card";
import { Notice } from "@/components/ui/states";

/**
 * The thirteen brand-safety checks an advertiser asks about.
 *
 * Each carries the note that produced its rating, because a grade nobody can
 * interrogate is worth very little to someone deciding whether to spend money
 * next to this content.
 *
 * `none` is deliberately worded as "not observed" rather than "clean". The
 * model graded a sample of recent uploads and their top comments — that is
 * evidence of absence in the material read, not a guarantee about the channel,
 * and the distinction is the whole point of the provenance model.
 */

const ORDER = [
  "hateSpeech",
  "extremistContent",
  "violence",
  "adultContent",
  "sexualContent",
  "drugs",
  "dangerousContent",
  "gambling",
  "profanity",
  "politicalContent",
  "controversialTopics",
  "misinformationSignals",
  "reputationRisk",
] as const;

const LABEL: Record<string, string> = {
  profanity: "Profanity",
  hateSpeech: "Hate speech",
  violence: "Violence",
  drugs: "Drugs",
  sexualContent: "Sexual content",
  dangerousContent: "Dangerous content",
  extremistContent: "Extremist content",
  gambling: "Gambling",
  controversialTopics: "Controversial topics",
  politicalContent: "Political content",
  misinformationSignals: "Misinformation signals",
  adultContent: "Adult content",
  reputationRisk: "Reputation risk",
};

const LEVEL: Record<string, { label: string; tone: BadgeTone }> = {
  none: { label: "Not observed", tone: "neutral" },
  low: { label: "Low", tone: "positive" },
  moderate: { label: "Moderate", tone: "caution" },
  high: { label: "High", tone: "critical" },
};

export function BrandSafetyPanel({ profile }: { profile: InfluencerProfile }) {
  const ai = profile.ai;

  if (!ai || Object.keys(ai.safetyChecks).length === 0) {
    return (
      <Notice tone="info" title="Brand safety has not been assessed">
        These checks are produced by the AI layer from recent uploads and their comments,
        which has not run for this creator. Nothing is being withheld — it has not been
        measured, and an unrated creator is not a cleared one.
      </Notice>
    );
  }

  const flagged = ORDER.filter((key) => {
    const level = ai.safetyChecks[key]?.level;
    return level === "moderate" || level === "high";
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Brand safety</CardTitle>
        <Badge tone="inferred">
          <Sparkles className="size-3" aria-hidden />
          AI classified
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-[12px] leading-5 text-ink-muted">
          Graded from a sample of recent uploads and their top comments.{" "}
          <strong className="font-medium text-ink">Not observed</strong> means nothing of that
          kind appeared in the material read — evidence of absence in a sample, not a
          guarantee about the channel.
        </p>

        {flagged.length > 0 && (
          <Notice tone="caution" title={`${flagged.length} check${flagged.length === 1 ? "" : "s"} worth reading`}>
            {flagged.map((key) => LABEL[key]).join(", ")}.
          </Notice>
        )}

        <ul className="divide-y divide-line rounded-lg border border-line">
          {ORDER.map((key) => {
            const check = ai.safetyChecks[key];
            if (!check) return null;
            const level = LEVEL[check.level] ?? LEVEL.none;

            return (
              <li key={key} className="grid gap-1 px-3 py-2 sm:grid-cols-[13rem_auto_1fr] sm:items-baseline sm:gap-3">
                <span className="text-[13px] text-ink">{LABEL[key]}</span>
                <Badge tone={level.tone} dot>
                  {level.label}
                </Badge>
                <span className="text-[12px] leading-5 text-ink-muted">
                  {check.note || "Nothing observed in the sampled material."}
                </span>
              </li>
            );
          })}
        </ul>

        <p className="text-[11px] leading-5 text-ink-muted">
          {ai.provider} {ai.model} · prompt {ai.promptVersion} · schema {ai.schemaVersion}
        </p>
      </CardContent>
    </Card>
  );
}

/** Brands, products and collaborations read out of the creator's own material. */
export function BrandSignalsPanel({ profile }: { profile: InfluencerProfile }) {
  const ai = profile.ai;
  if (!ai) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Brands and products</CardTitle>
        <Badge tone="inferred">
          <Sparkles className="size-3" aria-hidden />
          AI classified
        </Badge>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-2">
        <ChipBlock title="Previously collaborated with" empty="No stated collaborations found">
          {ai.previousCollaborations.map((item) => (
            <li key={item.brand} className="text-[13px] text-ink">
              <span className="font-medium">{item.brand}</span>
              <span className="ml-1.5 text-[12px] text-ink-muted">— {item.evidence}</span>
            </li>
          ))}
        </ChipBlock>

        <div className="space-y-3">
          <Chips title="Brands mentioned" items={ai.mentionedBrands} />
          <Chips title="Products mentioned" items={ai.mentionedProducts} />
        </div>

        <Chips title="Brand affinity" items={ai.brandAffinity} />
        <Chips title="Competitor affinity" items={ai.competitorAffinity} />

        <Chips title="Creator interests" items={ai.creatorInterests} />
        <Chips title="Search keywords" items={ai.creatorKeywords} />
      </CardContent>
    </Card>
  );
}

function ChipBlock({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  const items = React.Children.toArray(children);
  return (
    <div>
      <Eyebrow>{title}</Eyebrow>
      {items.length === 0 ? (
        <p className="mt-1 text-[13px] text-ink-muted">{empty}</p>
      ) : (
        <ul className="mt-1.5 space-y-1.5">{items}</ul>
      )}
    </div>
  );
}

function Chips({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <Eyebrow>{title}</Eyebrow>
      {items.length === 0 ? (
        <p className="mt-1 text-[13px] text-ink-muted">None identified</p>
      ) : (
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {items.map((item) => (
            <li key={item}>
              <Badge tone="neutral">{item}</Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
