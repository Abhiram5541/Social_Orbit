"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { RegisterInput } from "@/lib/contracts/auth";
import { Button, ButtonGroup, SegmentButton } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/field";
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
      // The submitted page echoes the address the approval will be sent to.
      router.replace(`${body.redirectTo}?email=${encodeURIComponent(parsed.data.email)}`);
      router.refresh();
    } catch {
      setFormError("Could not reach the server. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {formError && (
        <Notice tone="critical" title="Could not create your account">
          {formError}
        </Notice>
      )}

      <fieldset>
        <legend className="label-caps text-ink-muted">Who you are</legend>
        <div className="mt-3 space-y-4">
          {/* The fork that changes the rest of the form is a visible choice,
              not an option buried in a select. */}
          <div className="flex flex-col gap-1.5">
            <span id="account-type-label" className="text-base font-medium text-ink">
              I am signing up as
            </span>
            <ButtonGroup aria-labelledby="account-type-label" className="grid w-full grid-cols-2">
              <SegmentButton
                active={accountType === "client"}
                onClick={() => setAccountType("client")}
              >
                Brand or agency
              </SegmentButton>
              <SegmentButton
                active={accountType === "influencer"}
                onClick={() => setAccountType("influencer")}
              >
                Creator
              </SegmentButton>
            </ButtonGroup>
            <input type="hidden" name="accountType" value={accountType} />
          </div>

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
        </div>
      </fieldset>

      <div className="border-t border-line pt-5">
        <fieldset>
          <legend className="label-caps text-ink-muted">Credentials</legend>
          <div className="mt-3 space-y-4">
            <Field
              label="Password"
              error={errors.password}
              hint="At least 12 characters, with upper and lower case letters and a number."
              required
            >
              <Input name="password" type="password" autoComplete="new-password" required />
            </Field>

            <Field label="Confirm password" error={errors.confirmPassword} required>
              <Input
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
              />
            </Field>
          </div>
        </fieldset>
      </div>

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
          <p role="alert" className="mt-1 text-sm text-critical">
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
