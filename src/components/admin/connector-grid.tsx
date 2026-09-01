import * as React from "react";
import { PLATFORM_LABEL } from "@/lib/contracts/common";
import { formatCompact, formatRelativeTime } from "@/lib/format";
import type { ConnectorState, ConnectorStatus } from "@/server/repositories/ops-repository";
import { Badge, type BadgeTone } from "@/components/ui/badge";

const STATE: Record<ConnectorState, { label: string; tone: BadgeTone }> = {
  live: { label: "Live", tone: "positive" },
  // Caution, not neutral: someone has supplied credentials and is entitled to
  // know they bought nothing yet.
  not_implemented: { label: "No adapter yet", tone: "caution" },
  degraded: { label: "Degraded", tone: "caution" },
  credentials_missing: { label: "Credentials missing", tone: "caution" },
  not_configured: { label: "Not configured", tone: "neutral" },
};

/**
 * Connector state is reported from what is actually configured. A connector
 * with no credentials shows as such rather than green — an integrations
 * dashboard that flatters itself is worse than none at all.
 */
export function ConnectorGrid({ connectors }: { connectors: ConnectorStatus[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {connectors.map((connector) => (
        // `min-w-0`: as a grid child the card defaults to `min-width: auto`,
        // so a non-wrapping badge pushes it past its track and spills into the
        // neighbouring column.
        <li key={connector.platform} className="min-w-0 rounded-lg border border-line p-3">
          {/* Name and status stack, always. Letting them share a line only
              works when the label is short — "Not configured" fits where
              "Credentials missing" does not — which left sibling cards
              starting at different heights. Stacking keeps the set aligned and
              never truncates a status, which is the point of this card. */}
          <div className="flex flex-col items-start gap-1.5">
            <span className="w-full truncate text-[14px] font-semibold text-ink">
              {PLATFORM_LABEL[connector.platform]}
            </span>
            <Badge tone={STATE[connector.state].tone} dot>
              {STATE[connector.state].label}
            </Badge>
          </div>

          <p className="mt-1.5 text-[12px] leading-5 text-ink-muted">{connector.notes}</p>

          <dl className="mt-2.5 space-y-1 border-t border-line pt-2 text-[12px]">
            <div className="flex justify-between gap-2">
              <dt className="text-ink-muted">Accounts tracked</dt>
              <dd className="font-num tabular-nums text-ink">
                {formatCompact(connector.accountsTracked)}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-ink-muted">Last sync</dt>
              <dd className="text-ink">{formatRelativeTime(connector.lastSuccessfulSync)}</dd>
            </div>
          </dl>

          {connector.missing.length > 0 && (
            <div className="mt-2 rounded border border-caution-line bg-caution-soft px-2 py-1.5">
              <p className="label-caps text-[10px] text-caution">Missing</p>
              <ul className="mt-1 space-y-0.5">
                {connector.missing.map((key) => (
                  // `break-all`: these are single unbroken tokens with no space
                  // or hyphen to wrap on, so without it they run past the box.
                  <li
                    key={key}
                    className="break-all font-num text-[11px] leading-4 text-caution"
                  >
                    {key}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
