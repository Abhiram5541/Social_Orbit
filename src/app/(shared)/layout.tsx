import { redirect } from "next/navigation";
import { getSession } from "@/server/auth/session";
import { quotaFor } from "@/server/repositories/usage-repository";
import { AppShell } from "@/components/shell/app-shell";

/**
 * Routes every signed-in role can reach, whatever workspace they belong to —
 * help and the notification inbox are linked from the shared topbar, so they
 * cannot live inside a single workspace's route group.
 */
export default async function SharedLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (!user) redirect("/login");

  return (
    <AppShell user={user} quota={user.orgKind === "client" ? quotaFor(user.orgId, user.plan) : null}>
      {children}
    </AppShell>
  );
}
