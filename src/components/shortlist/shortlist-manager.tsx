"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ListChecks, Plus } from "lucide-react";
import type { Shortlist } from "@/lib/contracts/campaign";
import type { InfluencerSummary } from "@/lib/contracts/influencer";
import { formatRelativeTime, pluralise } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { EmptyState, Notice } from "@/components/ui/states";

/* ---------------------------------------------------------------------------
 * Shortlists — DPR UC-09.
 *
 * Two flows share this component: browsing lists, and the "add this creator"
 * hand-off from discovery (`?add=<influencerId>`), which opens the picker
 * directly rather than making the user find the list first.
 * ------------------------------------------------------------------------ */

export function ShortlistManager({
  shortlists,
  pendingAdd,
}: {
  shortlists: Shortlist[];
  /** Creator handed over from discovery, already resolved server-side. */
  pendingAdd: InfluencerSummary | null;
}) {
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
    <div className="space-y-4">
      {done && (
        <Notice tone="positive" icon={ListChecks} title={`Added to ${done}`}>
          The creator is now on that shortlist and available for comparison and campaigns.
        </Notice>
      )}

      <div className="flex justify-end">
        <Button variant="primary" onClick={() => setCreating(true)} className="gap-1.5">
          <Plus className="size-4" aria-hidden />
          New shortlist
        </Button>
      </div>

      {shortlists.length === 0 ? (
        <Card>
          <EmptyState
            icon={ListChecks}
            title="No shortlists yet"
            description="Group creators you are considering, add notes for your team, then compare them or move the list straight into a campaign."
            action={
              <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
                Create your first shortlist
              </Button>
            }
          />
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shortlists.map((shortlist) => (
            <li key={shortlist.id}>
              <Card className="h-full transition-colors hover:border-line-strong">
                <Link href={`/shortlists/${shortlist.id}`} className="block rounded-xl p-4">
                  <p className="text-[15px] font-semibold text-ink">{shortlist.name}</p>
                  {shortlist.description && (
                    <p className="mt-1 line-clamp-2 text-[13px] text-ink-muted">
                      {shortlist.description}
                    </p>
                  )}
                  <p className="mt-3 text-[12px] text-ink-muted">
                    {pluralise(shortlist.itemCount, "creator")} · created by{" "}
                    {shortlist.createdByName} · updated {formatRelativeTime(shortlist.updatedAt)}
                  </p>
                </Link>
              </Card>
            </li>
          ))}
        </ul>
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
                <p className="truncate text-[14px] font-medium text-ink">
                  {pendingAdd.displayName}
                </p>
                <p className="truncate font-num text-[12px] text-ink-muted">
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
                      className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-sunken disabled:opacity-60"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium text-ink">
                          {shortlist.name}
                        </span>
                        <span className="block text-[12px] text-ink-muted">
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
    </div>
  );
}
