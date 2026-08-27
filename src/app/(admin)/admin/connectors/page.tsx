import type { Metadata } from "next";
import { PLATFORM_LABEL } from "@/lib/contracts/common";
import { requirePagePermission } from "@/server/auth/rbac";
import { connectorStatuses } from "@/server/repositories/ops-repository";
import { PageBody, PageHeader } from "@/components/shell/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Notice } from "@/components/ui/states";
import { ConnectorGrid } from "@/components/admin/connector-grid";

export const metadata: Metadata = { title: "Connectors" };
export const dynamic = "force-dynamic";

export default async function ConnectorsPage() {
  await requirePagePermission("admin:connectors", "/admin/connectors");
  const connectors = connectorStatuses();

  return (
    <>
      <PageHeader
        title="Platform connectors"
        description="One adapter per platform. Credentials come from the environment and are never editable from the browser."
      />
      <PageBody className="space-y-4">
        <Notice tone="info" title="Credentials are environment-managed">
          Connector secrets are read from server environment variables at boot. There is no
          UI to enter them, because a secret typed into a browser form has already travelled
          further than it should. Set them in your deployment environment and restart.
        </Notice>

        <ConnectorGrid connectors={connectors} />

        {connectors.map((connector) => (
          <Card key={connector.platform}>
            <CardHeader>
              <CardTitle>{PLATFORM_LABEL[connector.platform]}</CardTitle>
              <span className="font-num text-[12px] text-ink-muted">
                connectors/{connector.platform}
              </span>
            </CardHeader>
            <CardContent className="space-y-3 text-[13px]">
              <p className="text-ink-muted">{connector.notes}</p>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-ink-muted">
                  Required environment
                </p>
                <ul className="mt-1 space-y-1">
                  {connector.requires.map((key) => (
                    <li key={key} className="flex items-center gap-2">
                      <span
                        className={`size-1.5 rounded-full ${
                          connector.missing.includes(key) ? "bg-critical" : "bg-positive"
                        }`}
                        aria-hidden
                      />
                      <code className="font-num text-[12px] text-ink">{key}</code>
                      <span className="text-[12px] text-ink-muted">
                        {connector.missing.includes(key) ? "not set" : "set"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        ))}
      </PageBody>
    </>
  );
}
