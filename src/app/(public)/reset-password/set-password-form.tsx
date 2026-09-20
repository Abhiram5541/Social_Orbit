"use client";

import * as React from "react";
import Link from "next/link";
import { ResetPasswordInput } from "@/lib/contracts/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/states";

export function SetPasswordForm({ token }: { token: string }) {
  const [pending, setPending] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    const form = new FormData(event.currentTarget);
    const parsed = ResetPasswordInput.safeParse({
      token,
      password: form.get("password"),
      confirmPassword: form.get("confirmPassword"),
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0] ?? "form")] ??= issue.message;
      setErrors(next);
      return;
    }

    setPending(true);
    const response = await fetch("/api/internal/auth/reset", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed.data),
    }).catch(() => null);
    setPending(false);

    if (response?.ok) {
      setDone(true);
      return;
    }
    const body = (await response?.json().catch(() => null)) as
      | { error?: { message?: string; details?: Record<string, string[]> } }
      | null;
    const details = body?.error?.details;
    setErrors(
      details
        ? Object.fromEntries(Object.entries(details).map(([k, v]) => [k, v[0]]))
        : { form: body?.error?.message ?? "Something went wrong. Try again." },
    );
  }

  if (done) {
    return (
      <Notice tone="positive" title="Password set">
        You can sign in with it now.{" "}
        <Link href="/login" className="rounded font-medium text-brand-ink hover:underline">
          Go to sign in
        </Link>
      </Notice>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {errors.form && <Notice tone="critical">{errors.form}</Notice>}
      <Field label="New password" hint="At least 12 characters, with a number and both cases." error={errors.password ?? null} required>
        <Input name="password" type="password" autoComplete="new-password" autoFocus required />
      </Field>
      <Field label="Confirm password" error={errors.confirmPassword ?? null} required>
        <Input name="confirmPassword" type="password" autoComplete="new-password" required />
      </Field>
      <Button type="submit" variant="primary" size="lg" loading={pending} className="w-full">
        Set password
      </Button>
    </form>
  );
}
