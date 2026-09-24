"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/states";

/* Straight from a result set into a brief. A creator already on the campaign
 * is skipped rather than added twice, and the result says how many of each. */

export function AddToCampaign({
  campaigns,
  influencerIds,
  count,
  onClose,
  onDone,
}: {
  campaigns: { id: string; name: string }[];
  influencerIds: string[];
  count: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const router = useRouter();
  const [campaignId, setCampaignId] = React.useState(campaigns[0]?.id ?? "");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function add() {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/internal/campaigns/${campaignId}/participants`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ influencerIds }),
    }).catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      const body = (await response?.json().catch(() => null)) as { error?: { message?: string } } | null;
      setError(body?.error?.message ?? "Could not add them.");
      return;
    }
    onDone();
    router.push(`/campaigns/${campaignId}`);
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Add to a campaign"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={add} disabled={busy || !campaignId}>
            {busy ? "Adding…" : "Add"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-base text-ink-muted">
          {count} selected {count === 1 ? "creator" : "creators"}. Anyone already on the
          campaign is left as they are.
        </p>
        <Field label="Campaign">
          <Select value={campaignId} onChange={(event) => setCampaignId(event.target.value)}>
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name}
              </option>
            ))}
          </Select>
        </Field>
        {error && (
          <Notice tone="critical" title="Not added">
            {error}
          </Notice>
        )}
      </div>
    </Dialog>
  );
}
