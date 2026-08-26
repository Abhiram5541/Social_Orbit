import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ROLE_WORKSPACE } from "@/lib/contracts/auth";
import { WORKSPACE_HOME } from "@/lib/navigation";
import { getSession } from "@/server/auth/session";
import { MarketingChrome } from "@/components/shell/marketing-chrome";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Create an account" };

export default async function RegisterPage() {
  const session = await getSession();
  if (session) redirect(WORKSPACE_HOME[ROLE_WORKSPACE[session.role]]);

  return (
    <MarketingChrome>
      <div className="mx-auto max-w-md px-4 py-12 sm:px-6">
        <div className="space-y-1">
          <h1 className="text-[22px] font-semibold tracking-[-0.015em] text-ink">
            Create your account
          </h1>
          <p className="text-[13px] text-ink-muted">
            Free plan includes five influencer searches per month.
          </p>
        </div>
        <div className="mt-6">
          <RegisterForm />
        </div>
        <p className="mt-6 text-[13px] text-ink-muted">
          Already have an account?{" "}
          <Link href="/login" className="rounded font-medium text-brand-ink hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </MarketingChrome>
  );
}
