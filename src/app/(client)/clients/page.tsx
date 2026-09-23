import type { Metadata } from "next";
import { requirePagePermission } from "@/server/auth/rbac";
import { currentBrandIds } from "@/server/repositories/user-repository";
import { brandRollups, listTeam } from "@/server/services/agency-service";
import { PageBody, PageHeader } from "@/components/shell/app-shell";
import { Notice } from "@/components/ui/states";
import { ClientBook } from "@/components/agency/client-book";

export const metadata: Metadata = { title: "Clients" };
export const dynamic = "force-dynamic";

/** Your own row is left out: nobody restricts themselves out of their workspace. */
function restrictedTeam(
  team: { id: string; name: string; email: string; role: string; brandIds: string[] }[],
  selfId: string,
) {
  return team
    .filter((member) => member.id !== selfId)
    .map(({ id, name, email, brandIds }) => ({ id, name, email, brandIds }));
}

export default async function ClientsPage() {
  const user = await requirePagePermission("campaign:read", "/clients");
  const rollups = brandRollups(user);
  const team = restrictedTeam(await listTeam(user), user.id);
  const restricted = currentBrandIds(user).length > 0;

  return (
    <>
      <PageHeader
        title="Clients"
        description="Agencies run campaigns for other companies. Each client here is a separate book of work inside your own workspace — its own campaigns, shortlists and reports, rolled up, with reports shared under the client's name and mark rather than yours."
      />
      <PageBody className="space-y-4">
        {restricted && (
          <Notice tone="info" title="You are assigned to specific clients">
            Campaigns, shortlists and reports outside those clients are not shown to you
            anywhere in the workspace.
          </Notice>
        )}
        <ClientBook rollups={rollups} team={team} canAdd={!restricted} />
      </PageBody>
    </>
  );
}
