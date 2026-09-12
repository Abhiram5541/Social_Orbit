import * as React from "react";
import { PLAN_CONFIG, ROLE_LABEL, ROLE_PERMISSIONS, type SessionUser } from "@/lib/contracts/auth";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Notice } from "@/components/ui/states";
import { DataRow } from "@/components/intelligence/stat";

/**
 * Account settings, shared by all three workspaces. Identity and role are
 * read-only here on purpose — a user cannot grant themselves a permission from
 * their own settings page.
 */
/** "influencer:search" rows fold into ["influencer", ["search", …]], in the
    order the role definition lists them. */
function groupPermissions(permissions: readonly string[]): [string, string[]][] {
  const groups = new Map<string, string[]>();
  for (const permission of permissions) {
    const [resource, action = permission] = permission.split(":");
    const actions = groups.get(resource) ?? [];
    actions.push(action);
    groups.set(resource, actions);
  }
  return [...groups.entries()];
}

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
            <p className="text-base text-ink-muted">
              Sessions are signed, httpOnly and expire after seven days. Signing out clears the
              session immediately.
            </p>
            <div className="flex flex-wrap gap-2">
              {/* The reset flow is built and works, so the control uses it
                  rather than being a second, unimplemented path. */}
              <LinkButton href="/forgot-password">Change password</LinkButton>
            </div>
            <Notice tone="info" title="Two-factor authentication">
              Not yet available. When it ships it will be enforceable at the organisation level
              rather than left to each user. Remote session revocation ships alongside it.
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
          <p className="text-base text-ink-muted">
            Permissions come from your role and are enforced on the server for every request.
            Ask an administrator if you need a different role.
          </p>
          {/* Grouped by resource — every permission is resource:action, and a
              flat wall of chips hides that structure. */}
          <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
            {groupPermissions(permissions).map(([resource, actions]) => (
              <div key={resource} className="flex items-baseline justify-between gap-3 border-b border-line pb-1.5">
                <dt className="label-caps-sm text-ink-subtle">{resource.replace(/_/g, " ")}</dt>
                <dd>
                  <code className="font-num text-xs text-ink-muted">{actions.join(" · ")}</code>
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
