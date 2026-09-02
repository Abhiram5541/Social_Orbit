import * as React from "react";
import Link from "next/link";
import type {
  Integration,
  IntegrationCategory,
  IntegrationState,
} from "@/server/repositories/integrations-repository";
import { Badge, type BadgeTone } from "@/components/ui/badge";

/*
 * The integrations catalog, grouped by what each integration is for.
 *
 * Server component. The catalog arrives as plain data and the repository
 * import above is types-only, the same shape connector-grid uses — nothing
 * from `src/server` is pulled in at runtime, so this component stays safe to
 * render anywhere.
 */

const CATEGORY_LABEL: Record<IntegrationCategory, string> = {
  social_platforms: "Social platforms",
  commerce_attribution: "Commerce & attribution",
  crm: "CRM",
  communications: "Communications",
  storage: "Storage & export",
};

/** The one-line framing under each section heading. */
const CATEGORY_NOTE: Record<IntegrationCategory, string> = {
  social_platforms:
    "Data sources. These feed the influencer database, so each carries the full provenance treatment — see Connectors for live health.",
  commerce_attribution:
    "Close the loop from a campaign to revenue: what a placement actually sold, not what it reached.",
  crm: "Push shortlists and campaign outcomes into the systems a client team already lives in.",
  communications: "Deliver reports, alerts and anomaly notifications where the team reads them.",
  storage: "Scheduled report export to a client-owned bucket or drive.",
};

const STATE: Record<IntegrationState, { label: string; tone: BadgeTone }> = {
  live: { label: "Live", tone: "positive" },
  not_implemented: { label: "No adapter yet", tone: "caution" },
  degraded: { label: "Degraded", tone: "caution" },
  credentials_missing: { label: "Credentials missing", tone: "caution" },
  not_configured: { label: "Not configured", tone: "neutral" },
  planned: { label: "Planned", tone: "neutral" },
  deferred: { label: "Deferred — v1 scope", tone: "neutral" },
};

const CATEGORY_ORDER: IntegrationCategory[] = [
  "social_platforms",
  "commerce_attribution",
  "crm",
  "communications",
  "storage",
];

function IntegrationCard({ integration }: { integration: Integration }) {
  const state = STATE[integration.state];

  return (
    <li className="flex min-w-0 flex-col rounded-lg border border-line p-3">
      <div className="flex flex-col items-start gap-1.5">
        <span className="w-full truncate text-[14px] font-semibold text-ink">
          {integration.name}
        </span>
        <Badge tone={state.tone} dot>
          {state.label}
        </Badge>
      </div>

      <p className="mt-1.5 text-[12px] leading-5 text-ink-muted">{integration.purpose}</p>

      <p className="mt-2.5 border-t border-line pt-2 text-[12px] leading-5 text-ink-subtle">
        {integration.statusDetail}
      </p>

      {integration.missing.length > 0 && (
        <div className="mt-2 rounded border border-caution-line bg-caution-soft px-2 py-1.5">
          <p className="label-caps text-[10px] text-caution">Missing environment</p>
          <ul className="mt-1 space-y-0.5">
            {integration.missing.map((key) => (
              <li key={key} className="break-all font-num text-[11px] leading-4 text-caution">
                {key}
              </li>
            ))}
          </ul>
        </div>
      )}

      {integration.manageHref && (
        <p className="mt-auto pt-2">
          <Link
            href={integration.manageHref}
            className="rounded text-[12px] font-medium text-brand-ink hover:underline"
          >
            Connector health <span aria-hidden>→</span>
          </Link>
        </p>
      )}
    </li>
  );
}

export function IntegrationCatalog({ integrations }: { integrations: Integration[] }) {
  return (
    <div className="space-y-6">
      {CATEGORY_ORDER.map((category) => {
        const entries = integrations.filter((item) => item.category === category);
        if (entries.length === 0) return null;

        return (
          <section key={category} aria-labelledby={`integrations-${category}`}>
            <h2
              id={`integrations-${category}`}
              className="text-[14px] font-semibold text-ink"
            >
              {CATEGORY_LABEL[category]}
            </h2>
            <p className="mt-0.5 text-[12px] leading-5 text-ink-muted">
              {CATEGORY_NOTE[category]}
            </p>
            <ul className="mt-2.5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {entries.map((integration) => (
                <IntegrationCard key={integration.id} integration={integration} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
