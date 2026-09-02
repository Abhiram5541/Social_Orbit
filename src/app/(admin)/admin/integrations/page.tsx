import type { Metadata } from "next";
import { requirePagePermission } from "@/server/auth/rbac";
import { integrationCatalog } from "@/server/repositories/integrations-repository";
import { PageBody, PageHeader } from "@/components/shell/app-shell";
import { Notice } from "@/components/ui/states";
import { IntegrationCatalog } from "@/components/admin/integration-catalog";

export const metadata: Metadata = { title: "Integrations" };
export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  await requirePagePermission("admin:connectors", "/admin/integrations");
  const integrations = integrationCatalog();

  const live = integrations.filter((item) => item.state === "live").length;

  return (
    <>
      <PageHeader
        title="Integrations"
        description="Everything SocialOrbit connects to, graded by what actually works today."
      />
      <PageBody className="space-y-4">
        <Notice tone="info" title={`${live} of ${integrations.length} integrations are live`}>
          Status here is derived from the running environment, never asserted. An
          integration is Live only when an adapter is written and its credentials are
          set — a catalog of sixteen green ticks would cost this product every client
          who connected one and got nothing.
        </Notice>

        <IntegrationCatalog integrations={integrations} />
      </PageBody>
    </>
  );
}
