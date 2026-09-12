"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ListChecks, Plus } from "lucide-react";
import type { Shortlist } from "@/lib/contracts/campaign";
import type { InfluencerSummary } from "@/lib/contracts/influencer";
import { formatCompact, pluralise, NO_VALUE } from "@/lib/format";
import type { ShortlistSignal } from "@/server/services/workspace-intelligence";
import { PageBody, PageHeader } from "@/components/shell/app-shell";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Panel, PanelFoot, RowList } from "@/components/ui/panel";
import { ScorePill } from "@/components/intelligence/score";
import { StatRow, StatTile } from "@/components/intelligence/stat";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { EmptyState, Notice } from "@/components/ui/states";
import { RelativeTime } from "@/components/ui/relative-time";

/* ---------------------------------------------------------------------------
 * Shortlists — DPR UC-09.
 *
 * Two flows share this component: browsing lists, and the "add this creator"
 * hand-off from discovery (`?add=<influencerId>`), which opens the picker
 * directly rather than making the user find the list first.
 *
 * The page header lives here rather than in the route: the "New shortlist"
 * action opens the create dialog, and the dialog's owner is the only place
 * that can wire it.
 * ------------------------------------------------------------------------ */

export function ShortlistManager({
  shortlists,
  signals,
  pendingAdd,
}: {
  shortlists: Shortlist[];
  /**
   * Per-list roster reading, computed server-side. A type-only import from
   * `src/server` — the shape crosses the boundary, the module never does.
   */
  signals: ShortlistSignal[];
  /** Creator handed over from discovery, already resolved server-side. */
  pendingAdd: InfluencerSummary | null;
}) {
  const signalFor = React.useMemo(
    () => new Map(signals.map((signal) => [signal.id, signal])),
    [signals],
  );
  const totals = React.useMemo(
    () => ({
      creators: signals.reduce((sum, signal) => sum + signal.tracked, 0),
      reach: signals.reduce((sum, signal) => sum + (signal.totalReach ?? 0), 0),
      flagged: signals.reduce((sum, signal) => sum + signal.flagged, 0),
      verified: signals.reduce((sum, signal) => sum + signal.verified, 0),
    }),
    [signals],
  );
  const router = useRouter();
  const [creating, setCreating] = React.useState(false);
  const [picking, setPicking] = React.useState(Boolean(pendingAdd));
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<string | null>(null);

  async function addTo(shortlistId: string) {
    if (!pendingAdd) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/internal/shortlists/${shortlistId}/items`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ influencerId: pendingAdd.id }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message ?? "Could not add the creator.");
      setPicking(false);
      setDone(shortlists.find((list) => list.id === shortlistId)?.name ?? "the shortlist");
      router.replace("/shortlists");
      router.refresh();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/internal/shortlists", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: String(data.get("name") ?? ""),
          description: String(data.get("description") ?? "") || undefined,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message ?? "Could not create the shortlist.");
      setCreating(false);
      if (pendingAdd) await addTo(body.id);
      else router.refresh();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Discover"
        title="Shortlists"
        leadFigure={
          shortlists.length > 0 ? pluralise(totals.creators, "creator") : undefined
        }
        description="Group creators you are considering, annotate them for your team, and move a list straight into a campaign."
        actions={
          // On an empty workspace the EmptyState owns creation — one primary
          // per screen, so this steps down to secondary.
          <Button
            variant={shortlists.length === 0 ? "secondary" : "primary"}
            onClick={() => setCreating(true)}
            className="gap-1.5"
          >
            <Plus className="size-4" aria-hidden />
            New shortlist
          </Button>
        }
      />

      <PageBody className="space-y-4">
        {done && (
          <Notice tone="positive" icon={ListChecks} title={`Added to ${done}`}>
            The creator is now on that shortlist and available for comparison and campaigns.
          </Notice>
        )}

        {shortlists.length === 0 ? (
          <Card>
            <EmptyState
              icon={ListChecks}
              title="No shortlists yet"
              description="Group creators you are considering, add notes for your team, then compare them or move the list straight into a campaign."
              action={
                <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
                  Create a shortlist
                </Button>
              }
            />
          </Card>
        ) : (
          <>
            <StatRow>
              <StatTile
                label="Shortlists"
                value={shortlists.length}
                emphasis
                footnote="visible to your workspace"
              />
              <StatTile
                label="Creators tracked"
                value={formatCompact(totals.creators)}
                footnote="unique across all lists"
              />
              <StatTile
                label="Combined audience"
                value={formatCompact(totals.reach)}
                footnote="sum of observed followers"
              />
              <StatTile
                label="Flagged"
                value={totals.flagged}
                footnote={
                  totals.flagged === 0
                    ? "no measured risk signal"
                    : "medium or high audience risk"
                }
              />
            </StatRow>

            {/* An index, not a gallery. Each row carries the reading that
                decides whether the list is worth opening — a name and a count
                made the user open every one to find out. */}
            <Panel>
              <RowList>
                {shortlists.map((shortlist) => {
                  const signal = signalFor.get(shortlist.id);
                  return (
                    <li key={shortlist.id}>
                      <Link
                        href={`/shortlists/${shortlist.id}`}
                        className="flex flex-wrap items-center gap-x-8 gap-y-3 px-4 py-3 transition-colors hover:bg-sunken/70"
                      >
                        <span className="w-full min-w-0 sm:w-auto sm:flex-1">
                          <span className="block text-md font-semibold text-ink">
                            {shortlist.name}
                          </span>
                          {shortlist.description && (
                            <span className="mt-0.5 block max-w-xl text-sm text-ink-muted">
                              {shortlist.description}
                            </span>
                          )}
                          <span className="mt-1 block text-sm text-ink-subtle">
                            {shortlist.createdByName}
                            <span aria-hidden> · updated </span>
                            <RelativeTime at={shortlist.updatedAt} />
                          </span>
                        </span>

                        <dl className="flex flex-wrap gap-x-8 gap-y-2 sm:shrink-0 sm:text-right">
                          <div className="min-w-16">
                            <dt className="label-caps-sm text-ink-subtle">Creators</dt>
                            <dd className="font-num text-base text-ink">
                              {shortlist.itemCount}
                            </dd>
                          </div>
                          <div className="min-w-20">
                            <dt className="label-caps-sm text-ink-subtle">Audience</dt>
                            <dd className="font-num text-base text-ink">
                              {formatCompact(signal?.totalReach ?? null)}
                            </dd>
                          </div>
                          <div className="min-w-20">
                            <dt className="label-caps-sm text-ink-subtle">Confidence</dt>
                            <dd className="font-num text-base text-ink">
                              {signal?.medianConfidence == null
                                ? NO_VALUE
                                : `${Math.round(signal.medianConfidence)}%`}
                            </dd>
                          </div>
                          <div className="min-w-20">
                            <dt className="label-caps-sm text-ink-subtle">
                              Median health
                            </dt>
                            <dd className="sm:flex sm:justify-end">
                              <ScorePill
                                value={signal?.medianHealth ?? null}
                                label="Median health"
                                size="lg"
                              />
                            </dd>
                          </div>
                        </dl>
                      </Link>
                    </li>
                  );
                })}
              </RowList>
              <PanelFoot>
                Median health is computed across each list&apos;s members from their stored
                scores — it is a reading of the roster, never a score of the list itself.
              </PanelFoot>
            </Panel>
          </>
        )}

        <Dialog
          open={creating}
          onClose={() => setCreating(false)}
          title="New shortlist"
          description="Shortlists are visible to everyone in your workspace."
        >
          <form id="create-shortlist" onSubmit={create} className="space-y-4">
            {error && <Notice tone="critical">{error}</Notice>}
            <Field label="Name" required>
              <Input name="name" required autoFocus placeholder="Q4 technology launch" />
            </Field>
            <Field label="Description" hint="Optional. What this list is for.">
              <Textarea name="description" rows={3} />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" onClick={() => setCreating(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={busy}>
                Create
              </Button>
            </div>
          </form>
        </Dialog>

        <Dialog
          open={picking && Boolean(pendingAdd)}
          onClose={() => {
            setPicking(false);
            router.replace("/shortlists");
          }}
          title="Add to a shortlist"
        >
          {pendingAdd && (
            <div className="space-y-4">
              {error && <Notice tone="critical">{error}</Notice>}
              <div className="flex items-center gap-3 rounded-lg border border-line bg-sunken/50 p-3">
                <Avatar
                  name={pendingAdd.displayName}
                  src={pendingAdd.avatarUrl}
                  size="sm"
                  verification={pendingAdd.verification}
                />
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{pendingAdd.displayName}</p>
                  <p className="truncate font-num text-sm text-ink-muted">
                    @{pendingAdd.primaryHandle}
                  </p>
                </div>
              </div>

              {shortlists.length === 0 ? (
                <EmptyState
                  title="No shortlists yet"
                  description="Create one to save this creator."
                  action={
                    <Button size="sm" variant="primary" onClick={() => setCreating(true)}>
                      New shortlist
                    </Button>
                  }
                />
              ) : (
                <ul className="divide-y divide-line rounded-lg border border-line">
                  {shortlists.map((shortlist) => (
                    <li key={shortlist.id}>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => addTo(shortlist.id)}
                        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-sunken disabled:cursor-not-allowed disabled:text-ink-subtle disabled:hover:bg-transparent"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-base font-medium text-ink">
                            {shortlist.name}
                          </span>
                          <span className="block text-sm text-ink-muted">
                            {pluralise(shortlist.itemCount, "creator")}
                          </span>
                        </span>
                        <Plus className="size-4 shrink-0 text-ink-subtle" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <Button onClick={() => setCreating(true)} className="w-full gap-1.5">
                <Plus className="size-4" aria-hidden />
                New shortlist
              </Button>
            </div>
          )}
        </Dialog>
      </PageBody>
    </>
  );
}
