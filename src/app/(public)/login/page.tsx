import type { Metadata } from "next";
import * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ROLE_WORKSPACE } from "@/lib/contracts/auth";
import { WORKSPACE_HOME } from "@/lib/navigation";
import { getSession } from "@/server/auth/session";
import { Wordmark } from "@/components/shell/logo";
import { ScoreRing } from "@/components/intelligence/score";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await getSession();
  if (session) redirect(WORKSPACE_HOME[ROLE_WORKSPACE[session.role]]);

  const { next } = await searchParams;

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_minmax(26rem,32rem)]">
      {/* The pitch panel is desktop-only: on a phone it would push the form
          below the fold, and someone signing in already knows what this is. */}
      <section className="relative hidden flex-col justify-between overflow-hidden bg-instrument p-10 text-instrument-ink lg:flex">
        {/* The orbit, at the scale of the panel. The same geometry the mark is
            built from and the landing hero opens on, so a returning user meets
            the product's own material before the workspace loads. */}
        <svg
          aria-hidden
          viewBox="0 0 700 900"
          preserveAspectRatio="xMidYMid slice"
          className="pointer-events-none absolute inset-0 size-full"
        >
          <ellipse
            cx="180"
            cy="700"
            rx="460"
            ry="250"
            transform="rotate(-24 180 700)"
            fill="none"
            stroke="var(--color-instrument-line)"
            strokeWidth="1"
          />
          <ellipse
            cx="180"
            cy="700"
            rx="300"
            ry="160"
            transform="rotate(-24 180 700)"
            fill="none"
            stroke="var(--color-instrument-line)"
            strokeWidth="1"
          />
        </svg>

        <Link href="/" className="relative w-fit rounded">
          <Wordmark inverse />
        </Link>

        <div className="relative max-w-md space-y-8">
          {/* The most characteristic artifact in this product's world: a score
              with stated uncertainty, sweeping in like the real one does. */}
          <InstrumentPanel />
          <h1 className="font-display text-title font-bold tracking-display text-instrument-ink">
            Every number on a SENSO profile can tell you where it came from.
          </h1>
          <ul className="space-y-4">
            <Pitch
              title="Provenance on every fact"
              body="Verified, observed, estimated or AI-inferred — labelled, timestamped and traceable to a source."
            />
            <Pitch
              title="Deterministic scoring"
              body="Health, authenticity and risk are computed by versioned formulas in code. AI explains a score; it never sets one."
            />
            <Pitch
              title="OAuth-backed verification"
              body="Verified status is issued only after a creator connects their account and the identity match passes."
            />
          </ul>
        </div>

        <p className="relative text-sm text-instrument-subtle">
          © {new Date().getFullYear()} SENSO. Influencer intelligence platform.
        </p>
      </section>

      <section className="flex flex-col justify-center px-5 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-sm space-y-6">
          <Link href="/" className="inline-block rounded lg:hidden">
            <Wordmark />
          </Link>

          <div className="space-y-1">
            <h2 className="font-display text-title font-bold tracking-display text-ink">
              Sign in
            </h2>
            <p className="text-base text-ink-muted">
              Use your SENSO workspace account.
            </p>
          </div>

          {/* The password is read here, on the server, and only passed down
              where the seed accounts actually exist — so they never reach a
              bundle that has no accounts to sign into.

              Gated on DEV_SEED_PASSWORD rather than NODE_ENV because that is
              the same variable user-repository uses to decide whether to
              create the accounts at all. Keying both off one value means the
              picker cannot offer a sign-in that does not work, and cannot be
              hidden when one does. A production build shared over a tunnel is
              still a demo and still needs it; a real deployment simply leaves
              the variable unset, and then there are no accounts to list. */}
          <LoginForm
            next={next}
            devPassword={
              process.env.NODE_ENV === "production"
                ? // This page is public, so the password is only ever put in it
                  // when the deployment says it is a demo (SOCIALORBIT_DEMO_LOGINS).
                  // Otherwise the picker fills the email alone. Note a filled
                  // password is in the page source whether or not it is shown,
                  // so "fill but hide" would be the same exposure in disguise.
                  process.env.SOCIALORBIT_DEMO_LOGINS === "true"
                  ? process.env.DEV_SEED_PASSWORD
                  : process.env.DEV_SEED_PASSWORD
                    ? null
                    : undefined
                : (process.env.DEV_SEED_PASSWORD ?? "SENSO-Dev-2026")
            }
          />

          <p className="text-base text-ink-muted">
            New to SENSO?{" "}
            <Link href="/register" className="rounded font-medium text-brand-ink hover:underline">
              Create an account
            </Link>
          </p>

        </div>
      </section>
    </div>
  );
}

function Pitch({ title, body }: { title: string; body: string }) {
  return (
    <li className="border-t border-instrument-line pt-4">
      <p className="font-semibold text-instrument-ink">{title}</p>
      <p className="mt-1 text-base leading-5.5 text-instrument-muted">{body}</p>
    </li>
  );
}

/**
 * The same instrument housing the landing hero mounts, at reduced size — the
 * product's one dark surface greets a returning user before the light
 * workspace opens. Values are illustrative and the panel is aria-hidden;
 * nothing here claims to be a measurement.
 */
function InstrumentPanel() {
  return (
    <div
      aria-hidden
      className="animate-rise overflow-hidden rounded-2xl bg-instrument-raised text-instrument-ink shadow-instrument"
    >
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-instrument-line-strong px-4 py-3">
        <span className="label-caps text-instrument-muted">SENSO Health</span>
        <span className="label-caps-sm text-instrument-muted">
          Specimen — illustrative values
        </span>
      </header>
      <div className="flex items-center gap-5 p-4">
        <ScoreRing value={83} size={96} tone="instrument" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="label-caps text-instrument-muted">Data confidence</span>
            <span className="font-num text-base font-semibold">89%</span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-instrument-line-strong">
            <div
              className="animate-extend h-full rounded-full bg-brand-lift"
              style={{ width: "89%", "--stagger": "300ms" } as React.CSSProperties}
            />
          </div>
          <p className="text-xs text-instrument-muted">
            high confidence — separate from the score
          </p>
        </div>
      </div>
    </div>
  );
}
