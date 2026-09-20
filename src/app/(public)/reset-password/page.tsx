import type { Metadata } from "next";
import Link from "next/link";
import { MarketingChrome } from "@/components/shell/marketing-chrome";
import { SetPasswordForm } from "./set-password-form";

export const metadata: Metadata = { title: "Choose a password" };

/** Where a reset or invite email lands. The token is in the query string. */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; invite?: string }>;
}) {
  const { token = "", invite } = await searchParams;
  const invited = invite === "1";

  return (
    <MarketingChrome>
      <div className="mx-auto max-w-md px-4 py-14 sm:px-6">
        <div className="space-y-1">
          <h1 className="text-title font-semibold tracking-display text-ink">
            {invited ? "Welcome to SENSO" : "Choose a new password"}
          </h1>
          <p className="text-base text-ink-muted">
            {invited
              ? "Set a password for your account and you are in."
              : "Pick a password you have not used elsewhere."}
          </p>
        </div>
        <div className="mt-6">
          {token ? (
            <SetPasswordForm token={token} />
          ) : (
            <p className="text-base text-ink-muted">
              This link is missing its token. Open the link from your email again, or{" "}
              <Link href="/forgot-password" className="rounded font-medium text-brand-ink hover:underline">
                request a new one
              </Link>
              .
            </p>
          )}
        </div>
      </div>
    </MarketingChrome>
  );
}
