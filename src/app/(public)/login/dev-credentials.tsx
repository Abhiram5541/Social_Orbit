import { ROLE_LABEL, type Role } from "@/lib/contracts/auth";

/**
 * Development sign-in helper. Rendered only outside production, and only ever
 * shows the seed password that the local environment is already configured
 * with — it does not read or expose any real credential.
 */
const ACCOUNTS: { email: string; role: Role; note: string }[] = [
  { email: "admin@socialorbit.io", role: "super_admin", note: "Full platform access" },
  { email: "manager@socialorbit.io", role: "manager", note: "Influencer CRUD, verification review" },
  { email: "analyst@socialorbit.io", role: "analytics_manager", note: "Analytics, no user admin" },
  { email: "owner@northwind.example", role: "client_owner", note: "Growth plan client" },
  { email: "hello@lumen.example", role: "client_owner", note: "Free plan — 5 searches/month" },
  { email: "creator@socialorbit.io", role: "influencer", note: "Creator portal" },
];

export function DevCredentials() {
  if (process.env.NODE_ENV === "production") return null;

  const password = process.env.DEV_SEED_PASSWORD ?? "SocialOrbit-Dev-2026";

  return (
    <details className="rounded-lg border border-line bg-surface text-[12px]">
      <summary className="cursor-pointer select-none px-3 py-2 font-medium text-ink-muted">
        Development accounts
      </summary>
      <div className="border-t border-line px-3 py-2">
        <p className="mb-2 text-ink-muted">
          Local seed data only. Password for all accounts:{" "}
          <code className="rounded bg-sunken px-1 font-mono text-ink">{password}</code>
        </p>
        <ul className="divide-y divide-line">
          {ACCOUNTS.map((account) => (
            <li key={account.email} className="flex flex-wrap justify-between gap-x-3 py-1.5">
              <code className="font-mono text-ink">{account.email}</code>
              <span className="text-ink-subtle">
                {ROLE_LABEL[account.role]} · {account.note}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
