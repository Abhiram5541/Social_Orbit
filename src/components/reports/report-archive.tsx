"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Copy, FileText, Link2 } from "lucide-react";
import { formatDate, formatRelativeTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { EmptyState, Notice } from "@/components/ui/states";

/* ---------------------------------------------------------------------------
 * The report archive: generate one now, put one on a schedule, and open what
 * has already been generated.
 *
 * Every row here is a *snapshot*. The link opens the figures as they stood
 * when it ran, which is why the archive lists a generated-at time as
 * prominently as the name — two reports of the same campaign a month apart
 * are different documents, not two views of one.
 * ------------------------------------------------------------------------ */

export interface ArchiveReport {
  id: string;
  name: string;
  kind: string;
  token: string;
  publicLink: boolean;
  generatedAt: string;
  scheduleId: string | null;
}

export interface ArchiveSchedule {
  id: string;
  name: string;
  kind: string;
  cadence: string;
  nextRunAt: string;
  lastRunAt: string | null;
  enabled: boolean;
  recipients: string[];
}

interface Subject {
  id: string;
  name: string;
  kind: "campaign" | "shortlist";
}

const KIND_LABEL: Record<string, string> = {
  campaign: "Campaign",
  shortlist: "Shortlist",
  portfolio: "Portfolio",
};

export function ReportArchive({
  reports,
  schedules,
  subjects,
  brands,
}: {
  reports: ArchiveReport[];
  schedules: ArchiveSchedule[];
  subjects: Subject[];
  brands: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [cadence, setCadence] = React.useState("once");
  const [brandId, setBrandId] = React.useState("");
  const [recipients, setRecipients] = React.useState("");
  const [publicLink, setPublicLink] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState<string | null>(null);

  const chosen = subjects.find((entry) => entry.id === subject);
  const kind = chosen?.kind ?? "portfolio";

  async function submit() {
    setBusy(true);
    setError(null);
    const once = cadence === "once";
    const response = await fetch(
      once ? "/api/internal/reports" : "/api/internal/reports/schedules",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || `${KIND_LABEL[kind]} report`,
          kind,
          subjectId: chosen?.id ?? null,
          publicLink,
          brandId: brandId || null,
          ...(once
            ? {}
            : {
                cadence,
                recipients: recipients
                  .split(/[,\s]+/)
                  .map((value) => value.trim())
                  .filter(Boolean),
              }),
        }),
      },
    );
    setBusy(false);
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
      setError(body?.error?.message ?? "Could not generate the report.");
      return;
    }
    setName("");
    setRecipients("");
    router.refresh();
  }

  async function copy(token: string) {
    await navigator.clipboard.writeText(`${window.location.origin}/report/${token}`);
    setCopied(token);
    window.setTimeout(() => setCopied(null), 2000);
  }

  async function toggleSchedule(id: string, enabled: boolean) {
    await fetch("/api/internal/reports/schedules", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, enabled }),
    });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Generate a report</CardTitle>
        </CardHeader>
        <div className="grid gap-3 px-4 py-3 sm:grid-cols-2">
          <Field label="Name">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="September performance"
            />
          </Field>
          <Field label="Subject">
            <Select value={subject} onChange={(event) => setSubject(event.target.value)}>
              <option value="">Everything (portfolio)</option>
              {subjects.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {KIND_LABEL[entry.kind]} — {entry.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Run">
            <Select value={cadence} onChange={(event) => setCadence(event.target.value)}>
              <option value="once">Once, now</option>
              <option value="daily">Every day</option>
              <option value="weekly">Every week</option>
              <option value="monthly">Every month</option>
            </Select>
          </Field>
          {brands.length > 0 && (
            <Field
              label="Client"
              hint="The report goes out under this client's name and mark."
            >
              <Select value={brandId} onChange={(event) => setBrandId(event.target.value)}>
                <option value="">Your own</option>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {cadence !== "once" && (
            <Field label="Email to" hint="Comma separated. Each run sends the link.">
              <Input
                value={recipients}
                onChange={(event) => setRecipients(event.target.value)}
                placeholder="marketing@client.example"
              />
            </Field>
          )}
          <div className="sm:col-span-2">
            <Checkbox
              checked={publicLink}
              onChange={(event) => setPublicLink(event.target.checked)}
              label="Readable by link, without signing in"
            />
            <p className="mt-1 text-sm text-ink-subtle">
              Off by default. A report is openable by link only once you decide to share it —
              knowing the URL is not the same as being given permission.
            </p>
          </div>
          {error && (
            <div className="sm:col-span-2">
              <Notice tone="critical" title="Not generated">
                {error}
              </Notice>
            </div>
          )}
          <div className="sm:col-span-2">
            <Button onClick={submit} disabled={busy}>
              {busy ? "Working…" : cadence === "once" ? "Generate now" : "Schedule it"}
            </Button>
          </div>
        </div>
      </Card>

      {schedules.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Schedules</CardTitle>
          </CardHeader>
          <ul className="divide-y divide-rule">
            {schedules.map((schedule) => (
              <li key={schedule.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <CalendarClock className="size-4 shrink-0 text-ink-subtle" aria-hidden />
                <div className="min-w-0 flex-1 basis-48">
                  <p className="font-medium text-ink">{schedule.name}</p>
                  <p className="text-sm text-ink-muted">
                    {schedule.cadence} · next {formatDate(schedule.nextRunAt)}
                    {schedule.lastRunAt ? ` · last ran ${formatRelativeTime(schedule.lastRunAt)}` : " · not run yet"}
                    {schedule.recipients.length > 0 && ` · ${schedule.recipients.length} recipient${schedule.recipients.length === 1 ? "" : "s"}`}
                  </p>
                </div>
                <Badge tone={schedule.enabled ? "positive" : "neutral"}>
                  {schedule.enabled ? "On" : "Paused"}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleSchedule(schedule.id, !schedule.enabled)}
                >
                  {schedule.enabled ? "Pause" : "Resume"}
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Generated reports</CardTitle>
        </CardHeader>
        {reports.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Nothing generated yet"
            description="A report freezes the figures as they stand when it runs, so it can be quoted later without changing underneath you."
          />
        ) : (
          <ul className="divide-y divide-rule">
            {reports.map((report) => (
              <li key={report.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="label-caps w-20 shrink-0 text-ink-subtle">
                  {KIND_LABEL[report.kind] ?? report.kind}
                </span>
                <div className="min-w-0 flex-1 basis-48">
                  <p className="font-medium text-ink">{report.name}</p>
                  <p className="font-num text-sm text-ink-muted">
                    {formatDate(report.generatedAt)} · {formatRelativeTime(report.generatedAt)}
                    {report.scheduleId && " · scheduled"}
                  </p>
                </div>
                {report.publicLink ? (
                  <Badge tone="verified">Shared</Badge>
                ) : (
                  <Badge tone="neutral">Private</Badge>
                )}
                <a
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
                  href={`/report/${report.token}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Link2 className="size-3.5" aria-hidden />
                  Open
                </a>
                {report.publicLink && (
                  <Button variant="ghost" size="sm" onClick={() => copy(report.token)}>
                    <Copy className="size-3.5" aria-hidden />
                    {copied === report.token ? "Copied" : "Copy link"}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
