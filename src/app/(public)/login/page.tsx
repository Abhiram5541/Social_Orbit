import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BadgeCheck, LineChart, ShieldCheck } from "lucide-react";
import { ROLE_WORKSPACE } from "@/lib/contracts/auth";
import { WORKSPACE_HOME } from "@/lib/navigation";
import { getSession } from "@/server/auth/session";
import { Wordmark } from "@/components/shell/logo";
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
      <section className="hidden flex-col justify-between border-r border-line bg-surface p-10 lg:flex">
        <Link href="/" className="w-fit rounded">
          <Wordmark />
        </Link>

        <div className="max-w-md space-y-8">
          <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.02em] text-ink">
            Every number on a SocialOrbit profile can tell you where it came from.
          </h1>
          <ul className="space-y-5">
            <Pitch
              icon={ShieldCheck}
              title="Provenance on every fact"
              body="Verified, observed, derived, estimated or AI-inferred — labelled, timestamped and traceable to a source."
            />
            <Pitch
              icon={LineChart}
              title="Deterministic scoring"
              body="Health, authenticity and risk are computed by versioned formulas in code. AI explains a score; it never sets one."
            />
            <Pitch
              icon={BadgeCheck}
              title="OAuth-backed verification"
              body="Verified status is issued only after a creator connects their account and the identity match passes."
            />
          </ul>
        </div>

        <p className="text-[12px] text-ink-subtle">
          © {new Date().getFullYear()} SocialOrbit. Influencer intelligence platform.
        </p>
      </section>

      <section className="flex flex-col justify-center px-5 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-sm space-y-6">
          <Link href="/" className="inline-block rounded lg:hidden">
            <Wordmark />
          </Link>

          <div className="space-y-1">
            <h2 className="text-[22px] font-semibold tracking-[-0.015em] text-ink">
              Sign in
            </h2>
            <p className="text-[13px] text-ink-muted">
              Use your SocialOrbit workspace account.
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
                ? process.env.DEV_SEED_PASSWORD
                : (process.env.DEV_SEED_PASSWORD ?? "SocialOrbit-Dev-2026")
            }
          />

          <p className="text-[13px] text-ink-muted">
            New to SocialOrbit?{" "}
            <Link href="/register" className="rounded font-medium text-brand-ink hover:underline">
              Create an account
            </Link>
          </p>

        </div>
      </section>
    </div>
  );
}

function Pitch({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof ShieldCheck;
  title: string;
  body: string;
}) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-canvas text-brand">
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="space-y-0.5">
        <span className="block text-[14px] font-medium text-ink">{title}</span>
        <span className="block text-[13px] leading-5 text-ink-muted">{body}</span>
      </span>
    </li>
  );
}
