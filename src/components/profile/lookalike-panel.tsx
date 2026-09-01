import * as React from "react";
import Link from "next/link";
import { Sigma } from "lucide-react";
import type { InfluencerProfile } from "@/lib/contracts/influencer";
import { formatCompact } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, Eyebrow } from "@/components/ui/card";

/**
 * Cost efficiency and lookalikes.
 *
 * Both are derived rather than observed or inferred, so both are marked with
 * the derived sigil rather than the AI one. The distinction matters: these are
 * reproducible arithmetic over stored values, and re-running them on the same
 * inputs returns the same answer forever.
 */

function Band({
  label,
  band,
  hint,
  places = 2,
}: {
  label: string;
  band: { currency: string; low: number; high: number } | null;
  hint: string;
  places?: number;
}) {
  // dt/dd, not spans: a <dl> whose rows are not term/description pairs is a
  // list that says nothing to a screen reader, and axe rejects it outright.
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line pb-1.5">
      <dt className="text-[12px] text-ink-muted">
        {label}
        <span className="ml-1 text-ink-subtle">({hint})</span>
      </dt>
      <dd className="font-num tabular-nums text-[13px] text-ink">
        {band
          ? `$${band.low.toFixed(places)} – $${band.high.toFixed(places)}`
          : "Not enough data"}
      </dd>
    </div>
  );
}

export function CostEfficiencyPanel({ profile }: { profile: InfluencerProfile }) {
  const cost = profile.costEfficiency;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cost efficiency</CardTitle>
        <Badge tone="neutral">
          <Sigma className="size-3" aria-hidden />
          Modelled
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <dl className="space-y-2">
          <Band
            label="Rate per placement"
            band={cost.placementRate}
            hint="modelled"
            places={0}
          />
          <Band label="CPM" band={cost.cpm} hint="per 1,000 views" />
          <Band label="CPE" band={cost.cpe} hint="per engagement" />
          <Band label="CPV" band={cost.cpv} hint="per view" places={4} />
        </dl>

        <p className="text-[11px] leading-5 text-ink-muted">
          Derived from the modelled earnings range and this creator&apos;s own observed median
          views, not from a rate card. SocialOrbit does not hold this creator&apos;s asking
          rate, and they have not quoted one — treat these as an order of magnitude, not a
          price.
        </p>
      </CardContent>
    </Card>
  );
}

export function LookalikePanel({
  profile,
  linkToProfiles = true,
}: {
  profile: InfluencerProfile;
  /**
   * False in the creator portal. A creator holds no permission to open another
   * creator's profile, so the link redirected them back to their own portal —
   * the comparison is still worth showing, the link is not.
   */
  linkToProfiles?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Similar creators</CardTitle>
        <Badge tone="neutral">
          <Sigma className="size-3" aria-hidden />
          Derived
        </Badge>
      </CardHeader>
      <CardContent>
        {profile.lookalikes.length === 0 ? (
          <p className="text-[13px] text-ink-muted">
            No comparable creators indexed yet. Similarity needs a shared category, so a
            creator alone in theirs has no lookalikes until the database grows.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {profile.lookalikes.map((match) => (
              <li key={match.id} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                <Avatar name={match.displayName} src={match.avatarUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  {linkToProfiles ? (
                    <Link
                      href={`/influencers/${match.id}`}
                      className="block truncate text-[13px] font-medium text-ink hover:text-brand-ink"
                    >
                      {match.displayName}
                    </Link>
                  ) : (
                    <span className="block truncate text-[13px] font-medium text-ink">
                      {match.displayName}
                    </span>
                  )}
                  <p className="truncate text-[11px] text-ink-muted">
                    {match.reasons.join(" · ")}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-num tabular-nums text-[13px] text-ink">
                    {formatCompact(match.followers)}
                  </p>
                  <p className="font-num text-[11px] text-ink-muted">{match.score}% match</p>
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-3 border-t border-line pt-2 text-[11px] leading-5 text-ink-muted">
          Weighted overlap of category, themes, audience size, country and language — not an
          embedding, so every match can say why it matched.
        </p>
      </CardContent>
    </Card>
  );
}

/** Where the model identified a publishing language distinct from the declared one. */
export function LanguageNote({ profile }: { profile: InfluencerProfile }) {
  const inferred = profile.ai?.primaryLanguage;
  if (!inferred) return null;

  return (
    <div>
      <Eyebrow>Publishing language</Eyebrow>
      <p className="mt-1 text-[13px] text-ink">{inferred}</p>
    </div>
  );
}
