import type { BadgeTone } from "@/components/ui/badge";
import type { IntegrationState } from "@/server/repositories/integrations-repository";
import type { ReviewItem } from "@/server/repositories/ops-repository";

/*
 * The admin workspace's status vocabulary, in one place. The same connector
 * state appears on the overview grid, the connectors page, the ingestion
 * table and the integrations catalog — one record means it cannot drift.
 * Types-only server imports, the same rule connector-grid follows.
 */

/** Connector and integration lifecycle states. `ConnectorState` is a subset. */
export const STATE: Record<IntegrationState, { label: string; tone: BadgeTone }> = {
  live: { label: "Live", tone: "positive" },
  // Caution, not neutral: someone has supplied credentials and is entitled to
  // know they bought nothing yet.
  not_implemented: { label: "No adapter yet", tone: "caution" },
  degraded: { label: "Degraded", tone: "caution" },
  credentials_missing: { label: "Credentials missing", tone: "caution" },
  // Credentials are complete; the upstream account itself has no active
  // billing. Caution, not critical: nothing is broken on this side.
  billing_required: { label: "Billing required", tone: "caution" },
  not_configured: { label: "Not configured", tone: "neutral" },
  planned: { label: "Planned", tone: "neutral" },
  deferred: { label: "Deferred — v1 scope", tone: "neutral" },
};

/** Review-queue severity dot, as a background class. */
export const SEVERITY: Record<ReviewItem["severity"], string> = {
  info: "bg-ink-subtle",
  warning: "bg-caution",
  critical: "bg-critical",
};
