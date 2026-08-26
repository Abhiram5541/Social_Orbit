import { redirect } from "next/navigation";
import { ROLE_WORKSPACE } from "@/lib/contracts/auth";
import { WORKSPACE_HOME } from "@/lib/navigation";
import { getSession } from "@/server/auth/session";
import { AppShell } from "@/components/shell/app-shell";

/** Platform operations workspace. Only the platform org reaches it. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (!user) redirect("/login");

  const workspace = ROLE_WORKSPACE[user.role];
  if (workspace !== "admin") redirect(WORKSPACE_HOME[workspace]);

  return <AppShell user={user}>{children}</AppShell>;
}
