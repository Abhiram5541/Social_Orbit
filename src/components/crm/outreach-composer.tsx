"use client";

import * as React from "react";
import { Send } from "lucide-react";
import type { CrmSummary } from "@/lib/contracts/crm";
import {
  MESSAGE_STATUS_LABEL,
  TEMPLATE_TOKENS,
  type OutreachMessage,
  type OutreachTemplate,
  type SendOutcome,
} from "@/lib/contracts/outreach";
import { formatRelativeTime } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { EmptyState, Notice } from "@/components/ui/states";

/* ---------------------------------------------------------------------------
 * Compose and send outreach to one creator or many.
 *
 * Recipients come from the organisation's own relationship records, because
 * an address SENSO never collected cannot be mailed: the creator index holds
 * no contact details, and the composer says so rather than offering a
 * recipient it cannot reach.
 * ------------------------------------------------------------------------ */

export function OutreachComposer({
  records,
  templates,
  campaigns,
  history,
}: {
  records: CrmSummary[];
  templates: OutreachTemplate[];
  campaigns: { id: string; name: string }[];
  history: OutreachMessage[];
}) {
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [campaignId, setCampaignId] = React.useState("");
  const [templateId, setTemplateId] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [outcomes, setOutcomes] = React.useState<SendOutcome[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const contactable = records.filter((record) => !record.contact.optedOutAt);

  function applyTemplate(id: string) {
    setTemplateId(id);
    const template = templates.find((entry) => entry.id === id);
    if (template) {
      setSubject(template.subject);
      setBody(template.body);
    }
  }

  async function send() {
    setBusy(true);
    setError(null);
    setOutcomes(null);
    const response = await fetch("/api/internal/outreach/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        influencerIds: [...selected],
        campaignId: campaignId || null,
        templateId: templateId || null,
        subject,
        body,
      }),
    }).catch(() => null);
    setBusy(false);

    if (response?.ok) {
      const report = (await response.json()) as { outcomes: SendOutcome[] };
      setOutcomes(report.outcomes);
      setSelected(new Set());
      return;
    }
    const failure = (await response?.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    setError(failure?.error?.message ?? "Could not send. Try again.");
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Compose</CardTitle>
          <span className="text-sm text-ink-muted">
            {selected.size} selected of {contactable.length} contactable
          </span>
        </CardHeader>

        <div className="space-y-4 px-4 py-4">
          {error && <Notice tone="critical">{error}</Notice>}
          {outcomes && (
            <Notice
              tone={outcomes.every((outcome) => outcome.ok) ? "positive" : "caution"}
              title={`${outcomes.filter((o) => o.ok).length} sent, ${outcomes.filter((o) => !o.ok).length} skipped`}
            >
              <ul className="mt-1 space-y-0.5">
                {outcomes.map((outcome) => (
                  <li key={outcome.influencerId} className="text-sm">
                    <span className="font-medium">{outcome.displayName}</span> — {outcome.detail}
                  </li>
                ))}
              </ul>
            </Notice>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Template" hint="Optional. Fills the subject and message.">
              <Select value={templateId} onChange={(event) => applyTemplate(event.target.value)}>
                <option value="">None</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Campaign" hint="Optional. Fills the campaign placeholders.">
              <Select value={campaignId} onChange={(event) => setCampaignId(event.target.value)}>
                <option value="">None</option>
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Subject" required>
            <Input value={subject} onChange={(event) => setSubject(event.target.value)} />
          </Field>
          <Field
            label="Message"
            required
            hint={`Placeholders: ${TEMPLATE_TOKENS.map((token) => `{{${token}}}`).join(", ")}`}
          >
            <Textarea value={body} onChange={(event) => setBody(event.target.value)} rows={7} />
          </Field>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-ink-muted">
              Each send is logged on the creator&apos;s timeline. A creator who opted out is
              never contacted, whatever is selected.
            </p>
            <Button
              variant="primary"
              onClick={send}
              loading={busy}
              disabled={selected.size === 0 || subject.trim().length < 2 || body.trim().length < 10}
              className="gap-1.5"
            >
              <Send className="size-4" aria-hidden />
              Send to {selected.size}
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recipients</CardTitle>
          <button
            type="button"
            className="press rounded-full bg-sunken px-3 py-1 text-sm font-medium text-ink-muted hover:text-ink"
            onClick={() =>
              setSelected((current) =>
                current.size === contactable.length
                  ? new Set()
                  : new Set(contactable.map((record) => record.influencerId)),
              )
            }
          >
            {selected.size === contactable.length && contactable.length > 0
              ? "Clear all"
              : "Select all"}
          </button>
        </CardHeader>
        {records.length === 0 ? (
          <EmptyState
            icon={Send}
            title="No relationships yet"
            description="Open a creator from discovery to start their record, then add an email address to contact them."
          />
        ) : (
          <ul className="divide-y divide-rule">
            {records.map((record) => {
              const address = record.contact.email ?? record.contact.managerEmail;
              const blocked = Boolean(record.contact.optedOutAt) || !address;
              return (
                <li key={record.id} className="flex items-center gap-3 px-4 py-2.5">
                  <Checkbox
                    label={<span className="sr-only">Select {record.displayName}</span>}
                    checked={selected.has(record.influencerId)}
                    disabled={blocked}
                    onChange={(event) =>
                      setSelected((current) => {
                        const next = new Set(current);
                        if (event.target.checked) next.add(record.influencerId);
                        else next.delete(record.influencerId);
                        return next;
                      })
                    }
                  />
                  <Avatar name={record.displayName} src={record.avatarUrl} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-ink">
                      {record.displayName}
                    </span>
                    <span className="block truncate text-sm text-ink-muted">
                      {record.contact.optedOutAt
                        ? "Opted out of outreach"
                        : (address ?? "No address on record")}
                    </span>
                  </span>
                  {record.contact.optedOutAt ? (
                    <Badge tone="critical">Opted out</Badge>
                  ) : !address ? (
                    <Badge tone="neutral">No address</Badge>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sent</CardTitle>
          <span className="text-sm text-ink-muted">
            Status is what the provider reported — nothing is assumed
          </span>
        </CardHeader>
        {history.length === 0 ? (
          <EmptyState icon={Send} title="Nothing sent yet" description="Messages appear here with whatever the mail provider reports back." />
        ) : (
          <ul className="divide-y divide-rule">
            {history.slice(0, 20).map((message) => (
              <li key={message.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-ink">{message.subject}</span>
                  <span className="block truncate text-sm text-ink-muted">
                    {message.displayName} · {message.to} · {formatRelativeTime(message.sentAt)} ·{" "}
                    {message.sentByName}
                  </span>
                </span>
                <Badge
                  tone={
                    message.status === "failed" || message.status === "bounced" || message.status === "complained"
                      ? "critical"
                      : message.status === "replied" || message.status === "opened"
                        ? "positive"
                        : "neutral"
                  }
                >
                  {MESSAGE_STATUS_LABEL[message.status]}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
