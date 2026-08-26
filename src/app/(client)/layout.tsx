import { redirect } from "next/navigation";
import { ROLE_WORKSPACE } from "@/lib/contracts/auth";
import { WORKSPACE_HOME } from "@/lib/navigation";
import { getSession } from "@/server/auth/session";
import { quotaFor } from "@/server/repositories/usage-repository";
import { AppShell } from "@/components/shell/app-shell";

/**
 * The client workspace. Session and workspace are resolved on the server, so
 * an unauthenticated request never renders application chrome at all.
 */
export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();
  if (!user) redirect("/login");

  const workspace = ROLE_WORKSPACE[user.role];
  if (workspace !== "client") redirect(WORKSPACE_HOME[workspace]);

  return (
    <AppShell user={user} quota={quotaFor(user.orgId, user.plan)}>
      {children}
    </AppShell>
  );
}
