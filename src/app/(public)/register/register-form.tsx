"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { RegisterInput } from "@/lib/contracts/auth";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/states";

export function RegisterForm() {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [accountType, setAccountType] = React.useState<"client" | "influencer">("client");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setErrors({});

    const data = new FormData(event.currentTarget);
    const parsed = RegisterInput.safeParse({
      name: data.get("name"),
      email: data.get("email"),
      organisation: data.get("organisation"),
      accountType: data.get("accountType"),
      password: data.get("password"),
      confirmPassword: data.get("confirmPassword"),
      acceptTerms: data.get("acceptTerms") === "on",
    });

    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message;
      setErrors(next);
      return;
    }

    setPending(true);
    try {
      const response = await fetch("/api/internal/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = await response.json();
      if (!response.ok) {
        setFormError(body?.error?.message ?? "Could not create the account.");
        if (body?.error?.details) {
          const next: Record<string, string> = {};
          for (const [key, messages] of Object.entries(
            body.error.details as Record<string, string[]>,
          )) {
            next[key] = messages[0];
          }
          setErrors(next);
        }
        return;
      }
      router.replace(body.redirectTo);
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
        <Notice tone="critical" title="Could not create your account">
          {formError}
        </Notice>
      )}

      <Field label="I am signing up as" required>
        <Select
          name="accountType"
          value={accountType}
          onChange={(event) =>
            setAccountType(event.currentTarget.value as "client" | "influencer")
          }
        >
          <option value="client">A brand or agency looking for creators</option>
          <option value="influencer">A creator claiming my own profile</option>
        </Select>
      </Field>

      <Field label="Full name" error={errors.name} required>
        <Input name="name" autoComplete="name" required />
      </Field>

      <Field label="Work email" error={errors.email} required>
        <Input name="email" type="email" autoComplete="username" required />
      </Field>

      <Field
        label={accountType === "client" ? "Organisation" : "Creator or channel name"}
        error={errors.organisation}
        required
      >
        <Input name="organisation" autoComplete="organization" required />
      </Field>

      <Field
        label="Password"
        error={errors.password}
        hint="At least 12 characters, with upper and lower case letters and a number."
        required
      >
        <Input name="password" type="password" autoComplete="new-password" required />
      </Field>

      <Field label="Confirm password" error={errors.confirmPassword} required>
        <Input name="confirmPassword" type="password" autoComplete="new-password" required />
      </Field>

      <div>
        <Checkbox
          name="acceptTerms"
          label={
            <>
              I agree to the{" "}
              <Link href="/terms" className="rounded font-medium text-brand-ink underline underline-offset-2">
                terms of service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="rounded font-medium text-brand-ink underline underline-offset-2">
                privacy policy
              </Link>
              .
            </>
          }
        />
        {errors.acceptTerms && (
          <p role="alert" className="mt-1 text-[12px] text-critical">
            {errors.acceptTerms}
          </p>
        )}
      </div>

      <Button type="submit" variant="primary" size="lg" loading={pending} className="w-full">
        Create account
      </Button>
    </form>
  );
}
