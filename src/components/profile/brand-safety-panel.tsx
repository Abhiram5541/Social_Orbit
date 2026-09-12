import * as React from "react";
import { Sparkles } from "lucide-react";
import type { InfluencerProfile } from "@/lib/contracts/influencer";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  Eyebrow,
} from "@/components/ui/card";
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
        <p className="text-sm leading-5 text-ink-muted">
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
                <span className="text-base text-ink">{LABEL[key]}</span>
                {/* "Not observed" is the usual answer on ten of thirteen rows.
                    Rendered quiet — a hollow dot, no badge — so the flagged
                    rows the advertiser came for are the only colour here. */}
                {level === LEVEL.none ? (
                  <span className="inline-flex items-center gap-1.5 text-sm text-ink-subtle">
                    <span
                      className="size-1.5 shrink-0 rounded-full border border-line-strong"
                      aria-hidden
                    />
                    {level.label}
                  </span>
                ) : (
                  <Badge tone={level.tone} dot>
                    {level.label}
                  </Badge>
                )}
                <span className="text-sm leading-5 text-ink-muted">
                  {check.note || "Nothing observed in the sampled material."}
                </span>
              </li>
            );
          })}
        </ul>

        <p className="text-xs leading-5 text-ink-muted">
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

  const absent = POPULATED.filter(({ key }) => ai[key].length === 0).map(
    ({ title }) => title.toLowerCase(),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Brands and products</CardTitle>
        <Badge tone="inferred">
          <Sparkles className="size-3" aria-hidden />
          AI classified
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <ChipBlock title="Previously collaborated with" empty="No stated collaborations found">
          {ai.previousCollaborations.map((item) => (
            <li key={item.brand} className="text-base text-ink">
              <span className="font-medium">{item.brand}</span>
              <span className="ml-1.5 text-sm text-ink-muted">— {item.evidence}</span>
            </li>
          ))}
        </ChipBlock>

        {/* Only the blocks that found something. Six headings reading "None
            identified" in a two-column grid spent half a screen telling the
            reader nothing, and made an honestly sparse profile look broken.
            The absent ones are named once, in a line, at the end. */}
        {POPULATED.map(({ title, key }) => {
          const items = ai[key];
          return items.length > 0 ? (
            <Chips key={title} title={title} items={items} />
          ) : null;
        })}
      </CardContent>
      {absent.length > 0 && (
        <CardFooter>
          Nothing was extracted for {listPhrase(absent)} — the model reports only
          what it found in the creator&apos;s own material, and never fills a gap.
        </CardFooter>
      )}
    </Card>
  );
}

const POPULATED = [
  { title: "Brands mentioned", key: "mentionedBrands" },
  { title: "Products mentioned", key: "mentionedProducts" },
  { title: "Brand affinity", key: "brandAffinity" },
  { title: "Competitor affinity", key: "competitorAffinity" },
  { title: "Creator interests", key: "creatorInterests" },
  { title: "Search keywords", key: "creatorKeywords" },
] as const;

function listPhrase(items: string[]): string {
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} or ${items[items.length - 1]}`;
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
        <p className="mt-1 text-base text-ink-muted">{empty}</p>
      ) : (
        <ul className="mt-1.5 space-y-1.5">{items}</ul>
      )}
    </div>
  );
}

/** Only called with a non-empty list — see the filter in BrandSignalsPanel. */
function Chips({ title, items }: { title: string; items: readonly string[] }) {
  return (
    <div>
      <Eyebrow>{title}</Eyebrow>
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {items.map((item) => (
          <li key={item} className="min-w-0 max-w-full">
            <Badge tone="neutral" className="whitespace-normal text-left">
              {item}
            </Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}
