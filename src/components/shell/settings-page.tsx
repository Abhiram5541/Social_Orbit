import * as React from "react";
import { PLAN_CONFIG, ROLE_LABEL, ROLE_PERMISSIONS, type SessionUser } from "@/lib/contracts/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Notice } from "@/components/ui/states";
import { DataRow } from "@/components/intelligence/stat";

/**
 * Account settings, shared by all three workspaces. Identity and role are
 * read-only here on purpose — a user cannot grant themselves a permission from
 * their own settings page.
 */
export function SettingsPanels({ user }: { user: SessionUser }) {
  const permissions = ROLE_PERMISSIONS[user.role];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Your account</CardTitle>
          </CardHeader>
          <CardContent>
            <dl>
              <DataRow label="Name" value={user.name} />
              <DataRow label="Email" value={user.email} />
              <DataRow label="Role" value={ROLE_LABEL[user.role]} />
              <DataRow label="Organisation" value={user.orgName} />
              <DataRow label="Organisation type" value={user.orgKind} />
              <DataRow label="Plan" value={PLAN_CONFIG[user.plan].label} />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Security</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-[13px] leading-5 text-ink-muted">
              Sessions are signed, httpOnly and expire after seven days. Signing out clears the
              session immediately.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button>Change password</Button>
              <Button variant="ghost">Sign out other sessions</Button>
            </div>
            <Notice tone="info" title="Two-factor authentication">
              Not yet available. When it ships it will be enforceable at the organisation level
              rather than left to each user.
            </Notice>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>What your role can do</CardTitle>
          <Badge tone="neutral">{permissions.length} permissions</Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-[13px] text-ink-muted">
            Permissions come from your role and are enforced on the server for every request.
            Ask an administrator if you need a different role.
          </p>
          <ul className="flex flex-wrap gap-1">
            {permissions.map((permission) => (
              <li key={permission}>
                <code className="rounded bg-sunken px-1.5 py-0.5 font-num text-[11px] text-ink-muted">
                  {permission}
                </code>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
