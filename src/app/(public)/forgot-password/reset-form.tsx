"use client";

import * as React from "react";
import { RequestResetInput } from "@/lib/contracts/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/states";

export function ResetForm() {
  const [pending, setPending] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = RequestResetInput.safeParse({
      email: new FormData(event.currentTarget).get("email"),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter a valid email address");
      return;
    }

    setPending(true);
    await fetch("/api/internal/auth/reset-request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed.data),
    }).catch(() => null);
    setPending(false);
    // Always the same outcome, whether or not the account exists — otherwise
    // this form becomes an account-enumeration oracle.
    setSent(true);
  }

  if (sent) {
    return (
      <Notice tone="positive" title="Check your inbox">
        If an account exists for that address, a reset link is on its way. The link expires in
        30 minutes.
      </Notice>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Field label="Work email" error={error} required>
        <Input name="email" type="email" autoComplete="username" autoFocus required />
      </Field>
      <Button type="submit" variant="primary" size="lg" loading={pending} className="w-full">
        Send reset link
      </Button>
    </form>
  );
}
