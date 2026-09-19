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

/**
 * The seats a demo walks through — the two platform roles, a paying client's
 * owner and member, and a free-plan client to show the search allowance. The
 * analyst and creator-portal seeds still exist (e2e exercises them) but are
 * not offered here.
 */
export const DEV_ACCOUNTS: DevAccount[] = [
  { email: "admin@senso360.com", role: "super_admin", note: "Full platform access" },
  { email: "manager@senso360.com", role: "manager", note: "Creator database, verification review" },
  { email: "owner@northwind.example", role: "client_owner", note: "Client workspace, billing and API keys" },
  { email: "member@northwind.example", role: "client_member", note: "Same workspace, no billing" },
  { email: "hello@lumen.example", role: "client_owner", note: "Free plan — 5 searches a month" },
];

export function DevCredentials({
  password,
  selected,
  onSelect,
}: {
  /**
   * The shared seed password, or null on a public deployment: there the
   * picker fills the email only and the password is typed. A production
   * sign-in page must never print the super admin's password.
   */
  password: string | null;
  selected: string | null;
  onSelect: (email: string, password: string | null) => void;
}) {
  return (
    <details className="rounded-lg bg-surface card-shadow text-sm" open>
      <summary className="cursor-pointer select-none rounded-t-lg px-3 py-2 font-medium text-ink-muted transition-colors hover:bg-sunken hover:text-ink">
        {password ? "Development accounts" : "Demo accounts"}
      </summary>
      <div className="border-t border-line px-3 py-2">
        <p className="mb-2 text-ink-muted">
          {password ? (
            <>
              Local seed data only. Pick an account to fill the form — password for all of
              them is <code className="rounded bg-sunken px-1 font-num text-ink">{password}</code>
            </>
          ) : (
            "Pick an account to fill the email, then enter the demo password."
          )}
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
                  className={`press flex w-full flex-wrap items-baseline justify-between gap-x-3 rounded px-1 py-1.5 text-left ${
                    isSelected ? "bg-brand-soft" : "hover:bg-sunken"
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
