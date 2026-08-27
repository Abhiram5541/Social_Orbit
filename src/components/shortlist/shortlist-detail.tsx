"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageSquare, Scale, Trash2, UserPlus } from "lucide-react";
import type { ShortlistDetail as ShortlistDetailData } from "@/lib/contracts/campaign";
import { PLATFORM_LABEL } from "@/lib/contracts/common";
import { formatCompact, formatPercent, formatRelativeTime } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/field";
import { EmptyState, Notice } from "@/components/ui/states";
import { Table, TableWrap, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table";
import { ScorePill } from "@/components/intelligence/score";
import { RelativeTime } from "@/components/ui/relative-time";

export function ShortlistDetailView({ shortlist }: { shortlist: ShortlistDetailData }) {
  const router = useRouter();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [noteFor, setNoteFor] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const editing = shortlist.items.find((item) => item.influencerId === noteFor);

  async function call(path: string, init: RequestInit) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(path, init);
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error?.message ?? "The change could not be saved.");
      }
      router.refresh();
      return true;
    } catch (cause) {
      setError((cause as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function remove(influencerId: string, name: string) {
    if (!window.confirm(`Remove ${name} from “${shortlist.name}”?`)) return;
    await call(
      `/api/internal/shortlists/${shortlist.id}/items?influencerId=${encodeURIComponent(influencerId)}`,
      { method: "DELETE" },
    );
  }

  async function saveNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const note = String(new FormData(event.currentTarget).get("note") ?? "");
    const ok = await call(`/api/internal/shortlists/${shortlist.id}/items`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ influencerId: editing.influencerId, note: note || null }),
    });
    if (ok) setNoteFor(null);
  }

  if (shortlist.items.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={UserPlus}
          title="This shortlist is empty"
          description="Add creators from discovery, then compare them side by side or move them into a campaign."
          action={
            <LinkButton href="/discovery" variant="primary" size="sm">
              Go to discovery
            </LinkButton>
          }
        />
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {error && <Notice tone="critical">{error}</Notice>}

      <div className="flex flex-wrap items-center gap-2">
        <LinkButton
          href={`/compare?ids=${[...(selected.size > 0 ? selected : shortlist.items.map((i) => i.influencerId))].join(",")}`}
          variant="primary"
          className="gap-1.5"
        >
          <Scale className="size-4" aria-hidden />
          Compare {selected.size > 0 ? `${selected.size} selected` : "all"}
        </LinkButton>
        <LinkButton href={`/campaigns/new?shortlist=${shortlist.id}`} className="gap-1.5">
          Start a campaign from this list
        </LinkButton>
      </div>

      <Card>
        <TableWrap label={`Creators on ${shortlist.name}`}>
          <Table>
            <Thead>
              <Tr>
                <Th className="w-9 pr-0">
                  <span className="sr-only">Select</span>
                </Th>
                <Th>Creator</Th>
                <Th numeric>Followers</Th>
                <Th numeric>Engagement</Th>
                <Th numeric>Health</Th>
                <Th numeric>Fit</Th>
                <Th>Note</Th>
                <Th>Added</Th>
                <Th className="text-right">
                  <span className="sr-only">Actions</span>
                </Th>
              </Tr>
            </Thead>
            <Tbody>
              {shortlist.items.map((item) => (
                <Tr key={item.id} selected={selected.has(item.influencerId)}>
                  <Td className="pr-0">
                    <input
                      type="checkbox"
                      checked={selected.has(item.influencerId)}
                      onChange={() =>
                        setSelected((previous) => {
                          const next = new Set(previous);
                          if (next.has(item.influencerId)) next.delete(item.influencerId);
                          else next.add(item.influencerId);
                          return next;
                        })
                      }
                      aria-label={`Select ${item.displayName}`}
                      className="size-3.5 cursor-pointer rounded accent-brand"
                    />
                  </Td>
                  <Td>
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Avatar name={item.displayName} src={item.avatarUrl} size="sm" />
                      <div className="min-w-0">
                        <Link
                          href={`/influencers/${item.influencerId}`}
                          className="block truncate rounded font-medium text-ink hover:text-brand-ink hover:underline"
                        >
                          {item.displayName}
                        </Link>
                        <p className="truncate text-[12px] text-ink-muted">
                          <span className="font-num">@{item.primaryHandle}</span> ·{" "}
                          {PLATFORM_LABEL[item.primaryPlatform]}
                        </p>
                      </div>
                    </div>
                  </Td>
                  <Td numeric>{formatCompact(item.followers)}</Td>
                  <Td numeric>{formatPercent(item.engagementRate)}</Td>
                  <Td numeric>
                    <ScorePill value={item.healthScore} label="Health" />
                  </Td>
                  <Td numeric>
                    <ScorePill value={item.campaignFit} label="Campaign fit" />
                  </Td>
                  <Td className="max-w-56">
                    <button
                      type="button"
                      onClick={() => setNoteFor(item.influencerId)}
                      className="flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left text-[12px] transition-colors hover:bg-sunken"
                    >
                      <MessageSquare className="size-3 shrink-0 text-ink-subtle" aria-hidden />
                      <span className={item.note ? "truncate text-ink" : "text-ink-subtle"}>
                        {item.note ?? "Add a note"}
                      </span>
                    </button>
                  </Td>
                  <Td className="whitespace-nowrap text-[12px] text-ink-muted">
                    <RelativeTime at={item.addedAt} />
                    <span className="block text-ink-subtle">by {item.addedByName}</span>
                  </Td>
                  <Td className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={busy}
                      onClick={() => remove(item.influencerId, item.displayName)}
                      aria-label={`Remove ${item.displayName} from this shortlist`}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </Button>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableWrap>
      </Card>

      <Dialog
        open={Boolean(editing)}
        onClose={() => setNoteFor(null)}
        title={editing ? `Note on ${editing.displayName}` : "Note"}
        description="Visible to everyone in your workspace."
      >
        <form onSubmit={saveNote} className="space-y-4">
          <Field label="Note">
            <Textarea
              name="note"
              rows={4}
              autoFocus
              defaultValue={editing?.note ?? ""}
              placeholder="Why this creator is on the list, or what to check before confirming."
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" onClick={() => setNoteFor(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={busy}>
              Save note
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
