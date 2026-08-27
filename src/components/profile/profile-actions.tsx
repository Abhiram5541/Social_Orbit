"use client";

import * as React from "react";
import { Check, Download, Megaphone, Plus, Scale } from "lucide-react";
import type { InfluencerProfile } from "@/lib/contracts/influencer";
import { Button, LinkButton } from "@/components/ui/button";

/* ---------------------------------------------------------------------------
 * Profile actions.
 *
 * "Add to shortlist" hands the creator to the shortlist picker through the URL,
 * the same route discovery uses — one flow, not two. Export writes the profile
 * out client-side from data already on the page, so it works today rather than
 * waiting on the report service.
 * ------------------------------------------------------------------------ */

/** Values that could contain a comma or quote are escaped per RFC 4180. */
function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(profile: InfluencerProfile): string {
  const rows: (string | number | null)[][] = [
    ["metric", "value", "provenance", "notes"],
    ["Name", profile.displayName, "observed", ""],
    ["Handle", `@${profile.primaryHandle}`, "observed", ""],
    ["Verification", profile.verification, "derived", ""],
    ["Country", profile.countryName, "observed", ""],
    ["Categories", profile.categories.join("; "), "inferred", "AI classification"],
    ["Followers", profile.glance.followers, "observed", ""],
    ["Total views", profile.glance.totalViews, "observed", ""],
    ["Median views", profile.glance.medianViews, "derived", "median of recent content"],
    ["Engagement rate %", profile.glance.engagementRate, "derived", ""],
    ["Upload frequency /wk", profile.glance.uploadFrequency, "derived", ""],
    [
      "Estimated monthly reach",
      profile.glance.estimatedMonthlyReach,
      "estimated",
      "modelled, not measured",
    ],
    ["Health score", profile.healthScore, "derived", profile.health.formulaVersion],
    ["Campaign fit", profile.campaignFit, "derived", profile.fit.formulaVersion],
    ["Risk level", profile.risk, "derived", ""],
    ["Estimated bot risk", profile.riskSignals.botRisk, "estimated", "0-100 signal, not a %"],
    ["Inactive audience", profile.riskSignals.inactiveAudience, "estimated", "0-100 signal"],
    [
      "Data confidence %",
      Math.round(profile.confidenceDetail.score),
      "derived",
      `${profile.confidenceDetail.band} — separate axis from quality`,
    ],
    ["Last refreshed", profile.lastRefreshedAt, "", ""],
  ];

  for (const component of profile.health.components) {
    rows.push([
      `Health component: ${component.key}`,
      component.available ? component.value : null,
      "derived",
      component.available ? `weight ${component.weight}` : "not measurable",
    ]);
  }

  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

export function ProfileActions({ profile }: { profile: InfluencerProfile }) {
  const [exported, setExported] = React.useState(false);

  function exportCsv() {
    const blob = new Blob([toCsv(profile)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `socialorbit-${profile.primaryHandle}-${profile.lastRefreshedAt?.slice(0, 10) ?? "profile"}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);

    setExported(true);
    window.setTimeout(() => setExported(false), 2500);
  }

  return (
    <div className="flex max-w-full flex-wrap items-center gap-2 sm:justify-end">
      <LinkButton
        href={`/shortlists?add=${profile.id}`}
        variant="primary"
        className="gap-1.5"
      >
        <Plus className="size-4" aria-hidden />
        Add to shortlist
      </LinkButton>
      <LinkButton href={`/compare?ids=${profile.id}`} className="gap-1.5">
        <Scale className="size-4" aria-hidden />
        Compare
      </LinkButton>
      <LinkButton href={`/campaigns/new?influencer=${profile.id}`} className="gap-1.5">
        <Megaphone className="size-4" aria-hidden />
        Campaign
      </LinkButton>
      <Button
        variant="ghost"
        onClick={exportCsv}
        aria-label={`Export ${profile.displayName} as CSV`}
        className="gap-1.5"
      >
        {exported ? (
          <Check className="size-4 text-positive" aria-hidden />
        ) : (
          <Download className="size-4" aria-hidden />
        )}
        {exported ? "Downloaded" : "Export"}
      </Button>
    </div>
  );
}
