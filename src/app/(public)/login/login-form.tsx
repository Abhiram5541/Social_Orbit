"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoginInput } from "@/lib/contracts/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/states";

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const data = new FormData(event.currentTarget);
    const parsed = LoginInput.safeParse({
      email: data.get("email"),
      password: data.get("password"),
    });

    // Validate client-side for immediate feedback; the server validates the
    // same schema again, because this check is a convenience, not a control.
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        errors[String(issue.path[0])] ??= issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setPending(true);
    try {
      const response = await fetch("/api/internal/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = await response.json();

      if (!response.ok) {
        setFormError(body?.error?.message ?? "Sign-in failed. Try again.");
        return;
      }

      router.replace(next ?? body.redirectTo);
      router.refresh();
    } catch {
      setFormError("Could not reach the server. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {formError && (
        <Notice tone="critical" title="Could not sign you in">
          {formError}
        </Notice>
      )}

      <Field label="Work email" error={fieldErrors.email} required>
        <Input
          name="email"
          type="email"
          autoComplete="username"
          placeholder="you@company.com"
          autoFocus
          required
        />
      </Field>

      <Field
        label="Password"
        error={fieldErrors.password}
        required
        labelSuffix={
          <Link
            href="/forgot-password"
            className="rounded text-[12px] text-brand-ink hover:underline"
          >
            Forgot password?
          </Link>
        }
      >
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>

      <Button type="submit" variant="primary" size="lg" loading={pending} className="w-full">
        Sign in
      </Button>
    </form>
  );
}
