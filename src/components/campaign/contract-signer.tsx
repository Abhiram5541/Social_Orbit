"use client";

import * as React from "react";
import {
  COMPENSATION_LABEL,
  CONTRACT_STATUS_LABEL,
  type Contract,
} from "@/lib/contracts/deal";
import { formatCurrency, formatDate, NO_VALUE } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/states";

/**
 * Read the terms and sign by typing a name. A typed name is a signature in
 * most jurisdictions when intent is recorded with it, which is why the
 * checkbox is a separate, explicit act rather than implied by the button.
 */
export function ContractSigner({ token, initial }: { token: string; initial: Contract }) {
  const [contract, setContract] = React.useState(initial);
  const [name, setName] = React.useState("");
  const [accept, setAccept] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const signed = contract.status === "signed";
  const closed = signed || contract.status === "expired" || contract.status === "void";

  async function sign() {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/public/contract/${token}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ signatureName: name, accept }),
    }).catch(() => null);
    setBusy(false);
    if (response?.ok) {
      setContract((await response.json()) as Contract);
      return;
    }
    const failure = (await response?.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    setError(failure?.error?.message ?? "Could not sign. Try again.");
  }

  const comp = contract.compensation;
  const rights = contract.usageRights;

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <p className="label-caps text-brand-ink">Agreement · v{contract.version}</p>
        <h1 className="display-sm text-ink">{contract.campaignName}</h1>
        <p className="flex items-center gap-2 text-base text-ink-muted">
          <Badge tone={signed ? "positive" : contract.status === "expired" ? "critical" : "neutral"}>
            {CONTRACT_STATUS_LABEL[contract.status]}
          </Badge>
          {formatDate(contract.startsOn)} – {formatDate(contract.endsOn)}
        </p>
      </header>

      {signed && (
        <Notice tone="positive" title="Signed">
          Signed by {contract.signatureName} on {formatDate(contract.signedAt)}. Keep this link
          for your records.
        </Notice>
      )}
      {contract.status === "expired" && (
        <Notice tone="critical" title="This agreement has expired">
          It was not signed before its expiry date. Nothing has been agreed — ask for a new one.
        </Notice>
      )}
      {error && <Notice tone="critical">{error}</Notice>}

      <Card>
        <CardHeader>
          <CardTitle>Terms</CardTitle>
        </CardHeader>
        <dl className="divide-y divide-rule">
          <Row label="Compensation">
            {COMPENSATION_LABEL[comp.model]}
            {comp.baseAmount !== null && ` · ${formatCurrency(comp.baseAmount, comp.currency)}`}
            {comp.commissionPct !== null && ` · ${comp.commissionPct}% commission`}
            {comp.bonusAmount !== null &&
              ` · bonus ${formatCurrency(comp.bonusAmount, comp.currency)}${comp.bonusCondition ? ` (${comp.bonusCondition})` : ""}`}
            {comp.giftingValue !== null &&
              ` · gifted product valued ${formatCurrency(comp.giftingValue, comp.currency)}`}
          </Row>
          <Row label="Deliverables">{contract.deliverablesSummary || NO_VALUE}</Row>
          <Row label="Territories">{rights.territories.join(", ") || NO_VALUE}</Row>
          <Row label="Channels">{rights.channels.join(", ") || NO_VALUE}</Row>
          <Row label="Usage period">
            {rights.durationMonths === null
              ? "In perpetuity"
              : `${rights.durationMonths} months${rights.expiresOn ? ` — until ${formatDate(rights.expiresOn)}` : ""}`}
          </Row>
          <Row label="Paid media">{rights.paidMedia ? "Permitted" : "Not permitted"}</Row>
          <Row label="Whitelisting">{rights.whitelisting ? "Permitted" : "Not permitted"}</Row>
          <Row label="Exclusivity">
            {rights.exclusivity
              ? `${rights.exclusivity}${rights.exclusivityEndsOn ? ` until ${formatDate(rights.exclusivityEndsOn)}` : ""}`
              : "None"}
          </Row>
        </dl>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Agreement</CardTitle>
        </CardHeader>
        <div className="whitespace-pre-wrap px-4 py-4 text-base leading-7 text-ink">
          {contract.body}
        </div>
      </Card>

      {!closed && (
        <Card>
          <CardHeader>
            <CardTitle>Sign</CardTitle>
          </CardHeader>
          <div className="space-y-3 px-4 py-4">
            <Field label="Your full name" required>
              <Input value={name} onChange={(event) => setName(event.target.value)} />
            </Field>
            <Checkbox
              label="I have read the terms above and agree to them."
              checked={accept}
              onChange={(event) => setAccept(event.target.checked)}
            />
            <Button
              variant="primary"
              onClick={sign}
              loading={busy}
              disabled={name.trim().length < 2 || !accept}
            >
              Sign agreement
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 px-4 py-2.5 sm:grid-cols-[10rem_1fr]">
      <dt className="text-sm text-ink-subtle">{label}</dt>
      <dd className="text-base text-ink">{children}</dd>
    </div>
  );
}
