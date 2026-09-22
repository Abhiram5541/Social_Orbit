"use client";

import * as React from "react";
import { MessageSquarePlus } from "lucide-react";
import {
  INTERACTION_LABEL,
  STAGE_LABEL,
  STAGE_ORDER,
  type CrmRecord,
  type RelationshipStage,
} from "@/lib/contracts/crm";
import { formatRelativeTime, NO_VALUE } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/states";
import { Spinner } from "@/components/ui/button";

/* ---------------------------------------------------------------------------
 * The relationship a client organisation has with one creator.
 *
 * Loaded on demand rather than with the profile: the creator index is shared
 * and this is not, so a platform administrator viewing the same page sees
 * nothing here at all. Opening the profile is what creates the record, which
 * is why a GET is enough to start one.
 * ------------------------------------------------------------------------ */

export function RelationshipPanel({ influencerId }: { influencerId: string }) {
  const [record, setRecord] = React.useState<CrmRecord | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    fetch(`/api/internal/crm/${influencerId}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: CrmRecord | null) => {
        if (!cancelled && data) setRecord(data);
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [influencerId]);

  async function send(path: string, method: "PATCH" | "POST", body: unknown) {
    setBusy(true);
    setError(null);
    const response = await fetch(path, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    setBusy(false);
    if (response?.ok) {
      setRecord((await response.json()) as CrmRecord);
      return true;
    }
    const failure = (await response?.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    setError(failure?.error?.message ?? "Could not save. Try again.");
    return false;
  }

  if (!record) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Relationship</CardTitle>
        </CardHeader>
        <p className="flex items-center gap-2 px-4 py-6 text-base text-ink-muted">
          <Spinner /> Loading your record for this creator…
        </p>
      </Card>
    );
  }

  const components = record.relationship.components;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Relationship</CardTitle>
        <span className="text-sm text-ink-muted">
          Your organisation&apos;s record — never shared with other clients
        </span>
      </CardHeader>

      {error && (
        <div className="px-4 pt-3">
          <Notice tone="critical">{error}</Notice>
        </div>
      )}

      <div className="grid gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Field label="Stage">
            <Select
              value={record.stage}
              disabled={busy}
              onChange={(event) =>
                void send(`/api/internal/crm/${influencerId}`, "PATCH", {
                  stage: event.target.value as RelationshipStage,
                })
              }
            >
              {STAGE_ORDER.map((stage) => (
                <option key={stage} value={stage}>
                  {STAGE_LABEL[stage]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Tags" hint="Comma separated.">
            <Input
              defaultValue={record.tags.join(", ")}
              disabled={busy}
              onBlur={(event) => {
                const tags = event.target.value
                  .split(",")
                  .map((tag) => tag.trim())
                  .filter(Boolean);
                if (tags.join("|") !== record.tags.join("|")) {
                  void send(`/api/internal/crm/${influencerId}`, "PATCH", { tags });
                }
              }}
            />
          </Field>

          <fieldset className="space-y-3 rounded-xl bg-sunken/60 p-3">
            <legend className="label-caps-sm px-1 text-ink-subtle">Contact</legend>
            {(
              [
                ["email", "Email"],
                ["phone", "Phone"],
                ["managerName", "Manager"],
                ["managerEmail", "Manager email"],
                ["agency", "Agency"],
              ] as const
            ).map(([key, label]) => (
              <Field key={key} label={label}>
                <Input
                  defaultValue={record.contact[key] ?? ""}
                  disabled={busy}
                  onBlur={(event) => {
                    const value = event.target.value.trim() || null;
                    if (value !== record.contact[key]) {
                      void send(`/api/internal/crm/${influencerId}`, "PATCH", {
                        contact: { [key]: value },
                      });
                    }
                  }}
                />
              </Field>
            ))}
            <p className="text-xs text-ink-subtle">
              Typed by your team. SENSO does not collect creator contact details from
              the platforms.
            </p>
          </fieldset>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl bg-sunken/60 p-3">
            <p className="label-caps-sm text-ink-subtle">Relationship strength</p>
            <p className="mt-1 font-num text-stat font-semibold text-ink">
              {record.relationship.value === null ? NO_VALUE : record.relationship.value}
              {record.relationship.value !== null && (
                <span className="ml-1 text-sm font-normal text-ink-subtle">/100</span>
              )}
            </p>
            <p className="mt-1 text-sm leading-5 text-ink-muted">
              {record.relationship.value === null
                ? "Nothing measurable yet. It is counted from replies, completed deliverables, on-time delivery and repeat campaigns — never from a rating somebody types."
                : `From ${Math.round(record.relationship.coverage * 100)}% of the formula: ${components.campaignsCompleted} completed, ${components.repeatCollaborations} repeat.`}
            </p>
          </div>

          <AddInteraction
            busy={busy}
            onSubmit={(body, kind) =>
              send(`/api/internal/crm/${influencerId}/interactions`, "POST", { body, kind })
            }
          />

          <div>
            <p className="label-caps-sm mb-2 text-ink-subtle">Timeline</p>
            {record.interactions.length === 0 ? (
              <p className="text-sm text-ink-muted">
                Nothing yet. Notes, emails, stage changes and campaign events appear here
                in order.
              </p>
            ) : (
              <ol className="divide-y divide-rule border-t border-rule">
                {record.interactions.slice(0, 12).map((entry) => (
                  <li key={entry.id} className="py-2.5">
                    <p className="flex flex-wrap items-center gap-2">
                      <Badge tone="neutral">{INTERACTION_LABEL[entry.kind]}</Badge>
                      <span className="text-sm text-ink-subtle">
                        {formatRelativeTime(entry.at)} · {entry.byName}
                      </span>
                    </p>
                    <p className="mt-1 text-base leading-6 text-ink">{entry.body}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function AddInteraction({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (body: string, kind: string) => Promise<boolean>;
}) {
  const [body, setBody] = React.useState("");
  const [kind, setKind] = React.useState("note");

  return (
    <form
      className="space-y-2"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!body.trim()) return;
        if (await onSubmit(body.trim(), kind)) setBody("");
      }}
    >
      <Field label="Log an interaction">
        <Textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={2}
          placeholder="What happened?"
        />
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          aria-label="Interaction type"
          value={kind}
          onChange={(event) => setKind(event.target.value)}
          className="w-40"
        >
          {(["note", "email_sent", "email_replied", "call", "meeting"] as const).map((entry) => (
            <option key={entry} value={entry}>
              {INTERACTION_LABEL[entry]}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="primary" loading={busy} className="gap-1.5">
          <MessageSquarePlus className="size-4" aria-hidden />
          Log
        </Button>
      </div>
    </form>
  );
}
