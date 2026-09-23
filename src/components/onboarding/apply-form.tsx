"use client";

import * as React from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { Platform } from "@/lib/contracts/common";
import {
  APPLICATION_STATUS_LABEL,
  type Application,
  type ApplicationStep,
} from "@/lib/contracts/onboarding";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/states";

type Draft = Omit<Application, "token">;

const STEPS: { key: ApplicationStep; label: string }[] = [
  { key: "profile", label: "About you" },
  { key: "socials", label: "Where you publish" },
  { key: "payout", label: "Payment details" },
  { key: "review", label: "Submitted" },
];

/**
 * The applicant's own form. Saves as they go, so the link they were given
 * is somewhere they can return to rather than one long sitting.
 */
export function ApplyForm({ token, initial }: { token: string; initial: Draft }) {
  const [application, setApplication] = React.useState(initial);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  const closed = application.status === "approved" || application.status === "rejected";

  async function save(patch: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/public/apply/${token}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    }).catch(() => null);
    setBusy(false);
    if (response?.ok) {
      setApplication((await response.json()) as Draft);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
      return true;
    }
    const failure = (await response?.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    setError(failure?.error?.message ?? "Could not save. Try again.");
    return false;
  }

  const socials = application.socials;

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="display-sm text-ink">Your application</h1>
        <p className="flex flex-wrap items-center gap-2 text-base text-ink-muted">
          <Badge
            tone={
              application.status === "approved"
                ? "positive"
                : application.status === "rejected"
                  ? "critical"
                  : "neutral"
            }
          >
            {APPLICATION_STATUS_LABEL[application.status]}
          </Badge>
          {application.name} · {application.email}
        </p>
      </header>

      {/* The applicant's own progress, so "what is left" never has to be
          guessed from which fields look empty. */}
      <ol className="flex flex-wrap gap-3">
        {STEPS.map((step) => {
          const done = application.completed.includes(step.key);
          return (
            <li key={step.key} className="flex items-center gap-1.5 text-sm">
              {done ? (
                <CheckCircle2 className="size-4 text-positive" aria-hidden />
              ) : (
                <Circle className="size-4 text-ink-subtle" aria-hidden />
              )}
              <span className={done ? "text-ink" : "text-ink-muted"}>{step.label}</span>
            </li>
          );
        })}
      </ol>

      {error && <Notice tone="critical">{error}</Notice>}
      {saved && <Notice tone="positive">Saved.</Notice>}
      {application.status === "approved" && (
        <Notice tone="positive" title="You're in">
          Your application was approved and matched to your creator record.
        </Notice>
      )}
      {application.status === "rejected" && (
        <Notice tone="critical" title="Not accepted">
          {application.reviewNote ?? "No reason was recorded."}
        </Notice>
      )}

      <Card>
        <CardHeader>
          <CardTitle>About you</CardTitle>
        </CardHeader>
        <div className="space-y-3 px-4 py-4">
          <Field label="Country">
            <Input
              defaultValue={application.country ?? ""}
              disabled={closed}
              onBlur={(event) => void save({ country: event.target.value.trim() || null })}
            />
          </Field>
          <Field label="Phone">
            <Input
              defaultValue={application.phone ?? ""}
              disabled={closed}
              onBlur={(event) => void save({ phone: event.target.value.trim() || null })}
            />
          </Field>
          <Field label="What you make" hint="A couple of sentences.">
            <Textarea
              rows={3}
              defaultValue={application.bio ?? ""}
              disabled={closed}
              onBlur={(event) => void save({ bio: event.target.value.trim() || null })}
            />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Where you publish</CardTitle>
          <span className="text-sm text-ink-muted">
            Figures are read from the platform, not from what you enter
          </span>
        </CardHeader>
        <div className="space-y-3 px-4 py-4">
          {socials.map((social, index) => (
            <div key={index} className="grid gap-2 sm:grid-cols-[8rem_1fr_9rem]">
              <Select
                value={social.platform}
                disabled={closed}
                aria-label="Platform"
                onChange={(event) => {
                  const next = [...socials];
                  next[index] = { ...social, platform: event.target.value as typeof social.platform };
                  void save({ socials: next.map(({ platform, handle, statedFollowers }) => ({ platform, handle, statedFollowers })) });
                }}
              >
                {Platform.options.map((platform) => (
                  <option key={platform} value={platform}>
                    {platform}
                  </option>
                ))}
              </Select>
              <Input
                defaultValue={social.handle}
                placeholder="handle"
                disabled={closed}
                aria-label="Handle"
                onBlur={(event) => {
                  const next = [...socials];
                  next[index] = { ...social, handle: event.target.value.trim() };
                  void save({ socials: next.map(({ platform, handle, statedFollowers }) => ({ platform, handle, statedFollowers })) });
                }}
              />
              <p className="self-center text-sm text-ink-muted">
                {social.resolvedFollowers === null
                  ? "Not yet matched"
                  : `${social.resolvedFollowers.toLocaleString("en-US")} measured`}
              </p>
            </div>
          ))}
          {!closed && (
            <Button
              variant="secondary"
              size="sm"
              loading={busy}
              onClick={() =>
                void save({
                  socials: [
                    ...socials.map(({ platform, handle, statedFollowers }) => ({ platform, handle, statedFollowers })),
                    { platform: "youtube", handle: "", statedFollowers: null },
                  ],
                })
              }
            >
              Add an account
            </Button>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment details</CardTitle>
          <span className="text-sm text-ink-muted">Used for payouts only — never shown to brands</span>
        </CardHeader>
        <div className="space-y-3 px-4 py-4">
          {(
            [
              ["legalName", "Legal name"],
              ["country", "Tax country"],
              ["taxId", "Tax ID"],
              ["bankName", "Bank"],
              ["accountLast4", "Account — last 4 digits only"],
              ["currency", "Preferred currency"],
            ] as const
          ).map(([key, label]) => (
            <Field key={key} label={label}>
              <Input
                defaultValue={application.payout[key] ?? ""}
                disabled={closed}
                onBlur={(event) =>
                  void save({ payout: { [key]: event.target.value.trim() || null } })
                }
              />
            </Field>
          ))}
          <p className="text-sm text-ink-subtle">
            SENSO records how to pay you, not your full account number.
          </p>
        </div>
      </Card>

      {!closed && application.status === "draft" && (
        <Button
          variant="primary"
          size="lg"
          loading={busy}
          className="w-full"
          onClick={() => void save({ submit: true })}
        >
          Submit for review
        </Button>
      )}
      {application.status === "submitted" && (
        <Notice tone="info" title="Submitted">
          Somebody will review this. You can still come back to this link to check its status.
        </Notice>
      )}
    </div>
  );
}
