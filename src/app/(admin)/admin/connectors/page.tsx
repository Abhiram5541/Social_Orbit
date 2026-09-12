import type { Metadata } from "next";
import { ChevronDown } from "lucide-react";
import { PLATFORM_LABEL } from "@/lib/contracts/common";
import { formatCompact, formatRelativeTime, pluralise } from "@/lib/format";
import { requirePagePermission } from "@/server/auth/rbac";
import { connectorStatuses } from "@/server/repositories/ops-repository";
import { PageBand, PageBody, PageHeader } from "@/components/shell/app-shell";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelBody, PanelHead, PanelTitle, RowList } from "@/components/ui/panel";
import { Notice } from "@/components/ui/states";
import { ConnectorProbe } from "@/components/admin/connector-probe";
import { XProbe } from "@/components/admin/x-probe";
import { STATE } from "@/components/admin/status-language";
import { Metric, MetricStrip } from "@/components/intelligence/signal";

export const metadata: Metadata = { title: "Connectors" };
export const dynamic = "force-dynamic";

export default async function ConnectorsPage() {
  await requirePagePermission("admin:connectors", "/admin/connectors");
  const connectors = connectorStatuses();

  const live = connectors.filter((connector) => connector.state === "live");
  const tracked = connectors.reduce(
    (sum, connector) => sum + connector.accountsTracked,
    0,
  );
  const blocked = connectors.filter(
    (connector) => connector.missing.length > 0,
  ).length;
  const freshest = connectors
    .map((connector) => connector.lastSuccessfulSync)
    .filter((value): value is string => value !== null)
    .sort()
    .at(-1);

  return (
    <>
      <PageHeader
        eyebrow="Trust & data"
        title="Connectors"
        description="One adapter per platform. Each is either reading, or it is not — and the reason it is not is stated rather than implied."
      />

      <PageBand inset={false}>
        <MetricStrip>
          <Metric
            label="Reading"
            value={`${live.length}/${connectors.length}`}
            tone="lead"
            footnote="adapters live"
          />
          <Metric
            label="Accounts tracked"
            value={formatCompact(tracked)}
            footnote="across every platform"
          />
          <Metric
            label="Last successful sync"
            value={freshest ? formatRelativeTime(freshest) : "—"}
            footnote="most recent across adapters"
          />
          <Metric
            label="Blocked on credentials"
            value={blocked}
            tone={blocked === 0 ? "muted" : "default"}
            footnote={blocked === 0 ? "none" : "set in the environment"}
          />
        </MetricStrip>
      </PageBand>

      <PageBody className="space-y-5">
        {/* The reading layer: what each platform is delivering, in the words a
            person who does not maintain the adapter would use. The credential
            checklist and the adapter's own notes are one disclosure below —
            present, findable, and not the first thing on the page. */}
        <Panel>
          <PanelHead>
            <PanelTitle>Platform coverage</PanelTitle>
            <span className="text-sm text-ink-muted">
              {pluralise(live.length, "adapter")} reading
            </span>
          </PanelHead>
          <RowList>
            {connectors.map((connector) => {
              const state = STATE[connector.state];
              return (
                <li key={connector.platform} data-connector={connector.platform}>
                  <details className="group">
                    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 transition-colors hover:bg-sunken/70 [&::-webkit-details-marker]:hidden">
                      <span className="flex min-w-40 flex-1 items-center gap-2.5">
                        <ChevronDown
                          className="size-4 shrink-0 text-ink-subtle transition-transform group-open:rotate-180"
                          aria-hidden
                        />
                        <span className="text-md font-semibold text-ink">
                          {PLATFORM_LABEL[connector.platform]}
                        </span>
                        <Badge tone={state.tone} dot>
                          {state.label}
                        </Badge>
                      </span>

                      <dl className="grid grid-cols-3 gap-x-6 gap-y-1 sm:w-[24rem] sm:shrink-0 sm:text-right">
                        <div>
                          <dt className="label-caps-sm text-ink-subtle">
                            Accounts tracked
                          </dt>
                          <dd className="font-num text-base text-ink">
                            {formatCompact(connector.accountsTracked)}
                          </dd>
                        </div>
                        <div>
                          <dt className="label-caps-sm text-ink-subtle">Last sync</dt>
                          <dd className="text-base text-ink">
                            {connector.lastSuccessfulSync
                              ? formatRelativeTime(connector.lastSuccessfulSync)
                              : "never"}
                          </dd>
                        </div>
                        <div>
                          <dt className="label-caps-sm text-ink-subtle">Credentials</dt>
                          <dd
                            className={
                              connector.missing.length === 0
                                ? "text-base text-positive"
                                : "text-base text-caution"
                            }
                          >
                            {connector.missing.length === 0
                              ? "complete"
                              : `${connector.missing.length} missing`}
                          </dd>
                        </div>
                      </dl>
                    </summary>

                    <div className="space-y-4 border-t border-rule bg-sunken/40 px-4 py-4 sm:pl-11">
                      <p className="max-w-3xl text-base text-ink-muted">
                        {connector.notes}
                      </p>
                      <div>
                        <p className="label-caps-sm text-ink-subtle">
                          Required environment
                        </p>
                        <ul className="mt-1.5 space-y-1">
                          {connector.requires.map((key) => {
                            const missing = connector.missing.includes(key);
                            return (
                              <li key={key} className="flex items-center gap-2">
                                <span
                                  className={`size-1.5 shrink-0 rounded-full ${
                                    missing ? "bg-critical" : "bg-positive"
                                  }`}
                                  aria-hidden
                                />
                                <code className="font-num text-sm text-ink">{key}</code>
                                <span className="text-sm text-ink-muted">
                                  {missing ? "not set" : "set"}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                      <p className="font-num text-sm text-ink-subtle">
                        src/server/connectors/{connector.platform}
                      </p>
                    </div>
                  </details>
                </li>
              );
            })}
          </RowList>
        </Panel>

        <Panel>
          <PanelHead>
            <PanelTitle>Credential checks</PanelTitle>
            <span className="text-sm text-ink-muted">
              A live call — the only thing that proves a key works
            </span>
          </PanelHead>
          <PanelBody className="space-y-4">
            <Notice tone="info" title="Credentials are environment-managed">
              Connector secrets are read from server environment variables at boot. There is
              no UI to enter them, because a secret typed into a browser form has already
              travelled further than it should. Set them in your deployment environment and
              restart.
            </Notice>

            {/* Whether the key *works* is a different question from whether it
                is *set*, and only a real call answers it. The panel is passed
                the configured flag rather than the key itself. */}
            <ConnectorProbe disabled={!process.env.YOUTUBE_API_KEY} />
            <XProbe disabled={!process.env.X_API_KEY || !process.env.X_API_SECRET} />
          </PanelBody>
        </Panel>
      </PageBody>
    </>
  );
}
