"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Hash } from "lucide-react";
import { PLATFORM_LABEL, SUPPORTED_PLATFORMS, type Platform } from "@/lib/contracts/common";
import { TrackingHashtag } from "@/lib/contracts/campaign";
import type { InfluencerSummary } from "@/lib/contracts/influencer";
import { formatCompact } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { EmptyState, Notice } from "@/components/ui/states";
import { ScorePill } from "@/components/intelligence/score";

/* ---------------------------------------------------------------------------
 * Campaign creation — Architecture doc §8, §10.
 *
 * The tracking hashtag is required, not optional: without one there is no way
 * to attribute a post to this campaign, and every performance figure further
 * downstream would be a guess.
 * ------------------------------------------------------------------------ */

export function CampaignForm({
  candidates,
  presetName,
}: {
  candidates: InfluencerSummary[];
  presetName?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [platforms, setPlatforms] = React.useState<Platform[]>(["youtube", "instagram"]);
  const [selected, setSelected] = React.useState<Set<string>>(
    new Set(candidates.map((candidate) => candidate.id)),
  );
  const [hashtag, setHashtag] = React.useState("");

  const hashtagCheck = React.useMemo(() => {
    if (!hashtag.trim()) return null;
    const result = TrackingHashtag.safeParse(hashtag);
    return result.success ? null : result.error.issues[0].message;
  }, [hashtag]);

  const today = new Date().toISOString().slice(0, 10);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setErrors({});

    const data = new FormData(event.currentTarget);
    const budgetRaw = String(data.get("budgetAmount") ?? "").trim();

    setBusy(true);
    try {
      const response = await fetch("/api/internal/campaigns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: String(data.get("name") ?? ""),
          brief: String(data.get("brief") ?? "") || undefined,
          hashtag: String(data.get("hashtag") ?? ""),
          platforms,
          startsOn: String(data.get("startsOn") ?? ""),
          endsOn: String(data.get("endsOn") ?? ""),
          budgetCurrency: String(data.get("budgetCurrency") ?? "INR"),
          budgetAmount: budgetRaw === "" ? null : Number(budgetRaw),
          influencerIds: [...selected],
        }),
      });
      const body = await response.json();

      if (!response.ok) {
        setFormError(body?.error?.message ?? "The campaign could not be created.");
        if (body?.error?.details) {
          const next: Record<string, string> = {};
          for (const [key, messages] of Object.entries(
            body.error.details as Record<string, string[]>,
          )) {
            next[key] = messages[0];
          }
          setErrors(next);
        }
        return;
      }

      router.push(`/campaigns/${body.id}`);
      router.refresh();
    } catch {
      setFormError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
      <div className="space-y-4">
        {formError && (
          <Notice tone="critical" title="Could not create the campaign">
            {formError}
          </Notice>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Campaign</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Campaign name" error={errors.name} required>
              <Input
                name="name"
                required
                autoFocus
                defaultValue={presetName}
                placeholder="Orbit Series launch"
              />
            </Field>

            <Field
              label="Brief"
              hint="Optional. What the campaign is for and what creators are being asked to do."
            >
              <Textarea name="brief" rows={3} />
            </Field>

            <Field
              label="Tracking hashtag"
              required
              error={errors.hashtag ?? hashtagCheck ?? undefined}
              hint="Required. Every post is attributed to this campaign by hashtag match, so it must be unique to this campaign."
            >
              <div className="relative">
                <Hash
                  className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-subtle"
                  aria-hidden
                />
                <Input
                  name="hashtag"
                  required
                  value={hashtag}
                  onChange={(event) => setHashtag(event.currentTarget.value)}
                  placeholder="OrbitSeries2026"
                  className="pl-8 font-num"
                  aria-describedby="hashtag-preview"
                />
              </div>
            </Field>
            {hashtag.trim() && !hashtagCheck && (
              <p id="hashtag-preview" className="-mt-2 text-[12px] text-ink-muted">
                Posts containing{" "}
                <span className="font-num text-ink">
                  #{hashtag.replace(/^#/, "")}
                </span>{" "}
                will be attributed to this campaign.
              </p>
            )}

            <fieldset>
              <legend className="text-[13px] font-medium text-ink">Platforms</legend>
              <p className="mb-1.5 text-[12px] text-ink-muted">
                Only platforms with a live connector can be tracked.
              </p>
              <div className="flex flex-wrap gap-4">
                {SUPPORTED_PLATFORMS.map((platform) => (
                  <Checkbox
                    key={platform}
                    label={PLATFORM_LABEL[platform]}
                    checked={platforms.includes(platform)}
                    onChange={() =>
                      setPlatforms((previous) =>
                        previous.includes(platform)
                          ? previous.filter((item) => item !== platform)
                          : [...previous, platform],
                      )
                    }
                  />
                ))}
              </div>
              {platforms.length === 0 && (
                <p role="alert" className="mt-1 text-[12px] text-critical">
                  Select at least one platform
                </p>
              )}
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Starts on" error={errors.startsOn} required>
                <Input type="date" name="startsOn" required defaultValue={today} />
              </Field>
              <Field label="Ends on" error={errors.endsOn} required>
                <Input type="date" name="endsOn" required />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-[7rem_1fr]">
              <Field label="Currency">
                <Select name="budgetCurrency" defaultValue="INR">
                  <option value="INR">INR</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </Select>
              </Field>
              <Field label="Budget" hint="Optional. Used to derive cost per engagement.">
                <Input type="number" name="budgetAmount" min={0} placeholder="e.g. 4500000" />
              </Field>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Creators</CardTitle>
            <span className="text-[12px] text-ink-muted">
              {selected.size} of {candidates.length} selected
            </span>
          </CardHeader>
          {candidates.length === 0 ? (
            <EmptyState
              title="No creators pre-selected"
              description="Create the campaign, then add creators from a shortlist or from discovery."
            />
          ) : (
            <ul className="max-h-96 divide-y divide-line overflow-y-auto">
              {candidates.map((candidate) => (
                <li key={candidate.id} className="flex items-center gap-3 px-4 py-2.5">
                  <input
                    type="checkbox"
                    checked={selected.has(candidate.id)}
                    onChange={() =>
                      setSelected((previous) => {
                        const next = new Set(previous);
                        if (next.has(candidate.id)) next.delete(candidate.id);
                        else next.add(candidate.id);
                        return next;
                      })
                    }
                    aria-label={`Include ${candidate.displayName}`}
                    className="size-3.5 shrink-0 cursor-pointer rounded accent-brand"
                  />
                  <Avatar
                    name={candidate.displayName}
                    src={candidate.avatarUrl}
                    size="sm"
                    verification={candidate.verification}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-ink">
                      {candidate.displayName}
                    </p>
                    <p className="truncate text-[12px] text-ink-muted">
                      {formatCompact(candidate.followers)} followers ·{" "}
                      {PLATFORM_LABEL[candidate.primaryPlatform]}
                    </p>
                  </div>
                  <ScorePill value={candidate.healthScore} label="Health" />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="flex items-center justify-end gap-2">
          <Button type="button" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={busy}
            disabled={platforms.length === 0 || Boolean(hashtagCheck)}
          >
            Create campaign
          </Button>
        </div>
      </div>
    </form>
  );
}
