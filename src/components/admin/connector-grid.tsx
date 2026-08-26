import * as React from "react";
import { PLATFORM_LABEL } from "@/lib/contracts/common";
import { formatCompact, formatRelativeTime } from "@/lib/format";
import type { ConnectorState, ConnectorStatus } from "@/server/repositories/ops-repository";
import { Badge, type BadgeTone } from "@/components/ui/badge";

const STATE: Record<ConnectorState, { label: string; tone: BadgeTone }> = {
  live: { label: "Live", tone: "positive" },
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
        <li key={connector.platform} className="rounded-lg border border-line p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[14px] font-medium text-ink">
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
              <dd className="font-mono tabular-nums text-ink">
                {formatCompact(connector.accountsTracked)}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-ink-muted">Last sync</dt>
              <dd className="text-ink">{formatRelativeTime(connector.lastSuccessfulSync)}</dd>
            </div>
          </dl>

          {connector.missing.length > 0 && (
            <p className="mt-2 rounded border border-caution-line bg-caution-soft px-2 py-1 font-mono text-[11px] text-caution">
              missing: {connector.missing.join(", ")}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
