import type { Metadata } from "next";
import Link from "next/link";
import { MarketingChrome } from "@/components/shell/marketing-chrome";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <MarketingChrome>
      <div className="mx-auto max-w-md px-4 py-14 sm:px-6">
        <div className="space-y-1">
          <h1 className="text-title font-semibold tracking-display text-ink">
            Reset your password
          </h1>
          <p className="text-base text-ink-muted">
            Enter your work email and we will send a reset link if an account exists.
          </p>
        </div>
        <div className="mt-6">
          <ResetForm />
        </div>
        <p className="mt-6 text-base text-ink-muted">
          Remembered it?{" "}
          <Link href="/login" className="rounded font-medium text-brand-ink hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </MarketingChrome>
  );
}
