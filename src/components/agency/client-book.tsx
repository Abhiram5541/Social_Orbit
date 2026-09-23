"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2, Plus } from "lucide-react";
import type { BrandRollup } from "@/lib/contracts/agency";
import { formatCompact, formatNumber } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { EmptyState, Notice } from "@/components/ui/states";
import { Table, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table";

/* ---------------------------------------------------------------------------
 * The agency's book of clients.
 *
 * One row per client, summing the work filed under it. A metric no platform
 * reported shows as absent rather than as zero — an agency reporting "0
 * views" for an Instagram-only client would be reporting a number nobody
 * measured (D44).
 * ------------------------------------------------------------------------ */

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  brandIds: string[];
}

export function ClientBook({
  rollups,
  team,
  canAdd,
}: {
  rollups: BrandRollup[];
  team: TeamMember[];
  canAdd: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [contactEmail, setContactEmail] = React.useState("");
  const [logoUrl, setLogoUrl] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function add() {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/internal/brands", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        contactEmail: contactEmail.trim() || null,
        logoUrl: logoUrl.trim() || null,
      }),
    });
    setBusy(false);
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
      setError(body?.error?.message ?? "Could not add the client.");
      return;
    }
    setName("");
    setContactEmail("");
    setLogoUrl("");
    setOpen(false);
    router.refresh();
  }

  async function assign(userId: string, brandIds: string[]) {
    await fetch("/api/internal/brands", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId, brandIds }),
    });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex items-center justify-between gap-3">
          <CardTitle>Clients</CardTitle>
          {canAdd && (
            <Button variant={open ? "ghost" : "secondary"} size="sm" onClick={() => setOpen(!open)}>
              <Plus className="size-3.5" aria-hidden />
              {open ? "Cancel" : "Add a client"}
            </Button>
          )}
        </CardHeader>
        {open && (
            <div className="grid gap-3 px-4 py-3 sm:grid-cols-3">
              <Field label="Name">
                <Input value={name} onChange={(event) => setName(event.target.value)} />
              </Field>
              <Field label="Contact email" hint="Where their reports go.">
                <Input
                  type="email"
                  value={contactEmail}
                  onChange={(event) => setContactEmail(event.target.value)}
                />
              </Field>
              <Field label="Logo" hint="A /brand/… path or an https URL.">
                <Input value={logoUrl} onChange={(event) => setLogoUrl(event.target.value)} />
              </Field>
              {error && (
                <div className="sm:col-span-3">
                  <Notice tone="critical" title="Not added">
                    {error}
                  </Notice>
                </div>
              )}
              <div className="sm:col-span-3">
                <Button onClick={add} disabled={busy || name.trim().length < 2}>
                  {busy ? "Adding…" : "Add client"}
                </Button>
              </div>
            </div>
          )}
          {rollups.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No clients yet"
              description="Add the companies you run campaigns for. Each one gets its own book of work, and reports you share go out under their name and mark rather than yours."
            />
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Client</Th>
                  <Th numeric>Campaigns</Th>
                  <Th numeric>Creators</Th>
                  <Th numeric>Posts</Th>
                  <Th numeric>Views</Th>
                  <Th numeric>Committed</Th>
                  <Th numeric>Fulfilment</Th>
                </Tr>
              </Thead>
              <Tbody>
                {rollups.map((row) => (
                  <Tr key={row.brand.id}>
                    <Td>
                      <span className="font-medium text-ink">{row.brand.name}</span>
                      {row.brand.status === "archived" && (
                        <Badge tone="neutral" className="ml-2">
                          Archived
                        </Badge>
                      )}
                      {row.activeCampaigns > 0 && (
                        <span className="ml-2 text-sm text-ink-muted">
                          {row.activeCampaigns} live
                        </span>
                      )}
                    </Td>
                    <Td numeric>{formatNumber(row.campaigns)}</Td>
                    <Td numeric>{formatNumber(row.creators)}</Td>
                    <Td numeric>{formatNumber(row.attributedPosts)}</Td>
                    <Td numeric>
                      {row.views === null ? (
                        <span className="text-ink-subtle">—</span>
                      ) : (
                        formatCompact(row.views)
                      )}
                    </Td>
                    <Td numeric>
                      {row.committed === null ? (
                        <span className="text-ink-subtle">—</span>
                      ) : (
                        `${row.currency} ${formatCompact(row.committed)}`
                      )}
                    </Td>
                    <Td numeric>
                      {row.fulfilmentPercent === null ? (
                        <span className="text-ink-subtle">—</span>
                      ) : (
                        `${row.fulfilmentPercent}%`
                      )}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
        )}
      </Card>

      {canAdd && rollups.length > 0 && team.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Who sees which client</CardTitle>
          </CardHeader>
          <ul className="divide-y divide-rule">
            {team.map((member) => (
              <li key={member.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1 basis-56">
                  <p className="font-medium text-ink">{member.name}</p>
                  <p className="text-sm text-ink-muted">{member.email}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {rollups.map((row) => {
                    const on = member.brandIds.includes(row.brand.id);
                    return (
                      <Button
                        key={row.brand.id}
                        size="sm"
                        variant={on ? "secondary" : "ghost"}
                        onClick={() =>
                          assign(
                            member.id,
                            on
                              ? member.brandIds.filter((id) => id !== row.brand.id)
                              : [...member.brandIds, row.brand.id],
                          )
                        }
                      >
                        {row.brand.name}
                      </Button>
                    );
                  })}
                  {member.brandIds.length === 0 && (
                    <span className="text-sm text-ink-subtle">Sees everything</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <div className="border-t border-line px-4 py-2.5">
            <p className="text-sm text-ink-subtle">
              Selecting none restores access to the whole workspace. A change takes effect on
              the next request, not at their next sign-in.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
