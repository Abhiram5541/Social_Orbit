"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { PLAN_CONFIG, ROLE_LABEL, type Plan, type Role } from "@/lib/contracts/auth";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/states";

/* ---------------------------------------------------------------------------
 * Account administration, super admin only.
 *
 * Onboarding a client is: create the organisation, create its owner, send the
 * invite. One dialog does the three. The person chooses their own password
 * from the emailed link, so no password ever passes through an admin.
 * ------------------------------------------------------------------------ */

interface OrgOption {
  id: string;
  name: string;
  kind: "platform" | "client";
}

const ROLES: Role[] = ["client_owner", "client_member", "influencer", "analytics_manager", "manager", "super_admin"];
const PLANS = Object.keys(PLAN_CONFIG) as Plan[];

async function call(method: "POST" | "PATCH", body: unknown): Promise<{ ok: true; data: unknown } | { ok: false; message: string }> {
  const response = await fetch("/api/internal/admin/users", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  if (response?.ok) return { ok: true, data: await response.json().catch(() => null) };
  const failure = (await response?.json().catch(() => null)) as { error?: { message?: string } } | null;
  return { ok: false, message: failure?.error?.message ?? "Something went wrong." };
}

export function NewAccountButton({ orgs }: { orgs: OrgOption[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [orgMode, setOrgMode] = React.useState<"existing" | "new">(orgs.some((o) => o.kind === "client") ? "existing" : "new");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const body: Record<string, unknown> = {
      name: form.get("name"),
      email: form.get("email"),
      role: form.get("role"),
    };
    if (orgMode === "new") {
      body.org = { name: form.get("orgName"), kind: "client", plan: form.get("plan") };
    } else {
      body.orgId = form.get("orgId");
    }
    setPending(true);
    const result = await call("POST", body);
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)} className="gap-1.5">
        <UserPlus className="size-4" aria-hidden />
        New account
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="New account"
        description="The person receives an email with a link to choose their password. The link is valid for 7 days."
      >
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {error && <Notice tone="critical">{error}</Notice>}
          <Field label="Full name" required>
            <Input name="name" autoComplete="off" required autoFocus />
          </Field>
          <Field label="Work email" required>
            <Input name="email" type="email" autoComplete="off" required />
          </Field>
          <Field label="Role" required>
            <Select name="role" defaultValue="client_owner">
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABEL[role]}
                </option>
              ))}
            </Select>
          </Field>

          <fieldset className="space-y-3 rounded-xl bg-sunken/60 p-3">
            <legend className="sr-only">Organisation</legend>
            <div className="flex gap-4 text-base">
              {(["existing", "new"] as const).map((mode) => (
                <label key={mode} className="inline-flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="orgMode"
                    value={mode}
                    checked={orgMode === mode}
                    onChange={() => setOrgMode(mode)}
                    className="accent-brand"
                  />
                  {mode === "existing" ? "Existing organisation" : "New client organisation"}
                </label>
              ))}
            </div>
            {orgMode === "existing" ? (
              <Field label="Organisation" required>
                <Select name="orgId" defaultValue={orgs[0]?.id}>
                  {orgs.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                      {org.kind === "platform" ? " (SENSO staff)" : ""}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <>
                <Field label="Organisation name" required>
                  <Input name="orgName" autoComplete="organization" required />
                </Field>
                <Field label="Plan" required>
                  <Select name="plan" defaultValue="growth">
                    {PLANS.map((plan) => (
                      <option key={plan} value={plan}>
                        {PLAN_CONFIG[plan].label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </>
            )}
          </fieldset>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={pending}>
              Create and send invite
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

/** Per-row actions: suspend / reinstate, and email a reset link. */
export function UserRowActions({
  userId,
  email,
  status,
  self,
}: {
  userId: string;
  email: string;
  status: "active" | "suspended";
  self: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<"status" | "reset" | null>(null);
  const [note, setNote] = React.useState<string | null>(null);

  async function toggle() {
    setBusy("status");
    const result = await call("PATCH", { userId, status: status === "active" ? "suspended" : "active" });
    setBusy(null);
    if (!result.ok) setNote(result.message);
    else router.refresh();
  }

  async function reset() {
    setBusy("reset");
    // The public endpoint: same behaviour a person gets from the sign-in page.
    await fetch("/api/internal/auth/reset-request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => null);
    setBusy(null);
    setNote("Reset link sent");
  }

  if (self) return <span className="text-sm text-ink-subtle">You</span>;

  return (
    <div className="flex items-center justify-end gap-1 whitespace-nowrap">
      {note && <span className="mr-1 text-sm text-ink-muted">{note}</span>}
      <Button size="sm" variant="ghost" onClick={reset} loading={busy === "reset"} disabled={status !== "active"}>
        Reset link
      </Button>
      <Button size="sm" variant={status === "active" ? "danger" : "secondary"} onClick={toggle} loading={busy === "status"}>
        {status === "active" ? "Suspend" : "Reinstate"}
      </Button>
    </div>
  );
}
