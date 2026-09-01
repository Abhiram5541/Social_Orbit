"use client";

import { ROLE_LABEL, type Role } from "@/lib/contracts/auth";

/* ---------------------------------------------------------------------------
 * Development sign-in helper.
 *
 * Rendered only where the seed accounts exist — the server decides that from
 * DEV_SEED_PASSWORD, the same variable that decides whether to create them,
 * and simply does not pass them in otherwise. So the list cannot offer a
 * sign-in that would fail, and cannot reach a build that has no accounts. It
 * shows the seed password the environment is already configured with; it
 * reads no real credential.
 * ------------------------------------------------------------------------ */

export interface DevAccount {
  email: string;
  role: Role;
  note: string;
}

export const DEV_ACCOUNTS: DevAccount[] = [
  { email: "admin@socialorbit.io", role: "super_admin", note: "Full platform access" },
  { email: "manager@socialorbit.io", role: "manager", note: "Influencer CRUD, verification review" },
  { email: "analyst@socialorbit.io", role: "analytics_manager", note: "Analytics, no user admin" },
  { email: "owner@northwind.example", role: "client_owner", note: "Growth plan client" },
  { email: "member@northwind.example", role: "client_member", note: "Same workspace, no billing" },
  { email: "hello@lumen.example", role: "client_owner", note: "Free plan — 5 searches/month" },
  { email: "creator@socialorbit.io", role: "influencer", note: "Creator portal" },
];

export function DevCredentials({
  password,
  selected,
  onSelect,
}: {
  password: string;
  selected: string | null;
  onSelect: (email: string, password: string) => void;
}) {
  return (
    <details className="rounded-lg border border-line bg-surface text-[12px]" open>
      <summary className="cursor-pointer select-none px-3 py-2 font-medium text-ink-muted">
        Development accounts
      </summary>
      <div className="border-t border-line px-3 py-2">
        <p className="mb-2 text-ink-muted">
          Local seed data only. Pick an account to fill the form — password for all of them
          is <code className="rounded bg-sunken px-1 font-num text-ink">{password}</code>
        </p>
        <ul className="divide-y divide-line">
          {DEV_ACCOUNTS.map((account) => {
            const isSelected = selected === account.email;

            return (
              <li key={account.email}>
                {/* A real button, so it is reachable by keyboard and announces
                    itself as pressed. The row is the target rather than a
                    separate "use" link — the whole line is what a person aims
                    at when the intent is "sign in as this one". */}
                <button
                  type="button"
                  onClick={() => onSelect(account.email, password)}
                  aria-pressed={isSelected}
                  className={`flex w-full flex-wrap items-baseline justify-between gap-x-3 rounded px-1 py-1.5 text-left transition-colors hover:bg-sunken ${
                    isSelected ? "bg-brand-soft" : ""
                  }`}
                >
                  <code className="font-num text-ink">{account.email}</code>
                  <span className="text-ink-subtle">
                    {ROLE_LABEL[account.role]} · {account.note}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </details>
  );
}
