"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/states";

/** Starts an application and hands the applicant their own link. */
export function ApplyStart({ orgId }: { orgId: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError(null);
        const form = new FormData(event.currentTarget);
        const response = await fetch(
          `/api/public/apply${orgId ? `?org=${encodeURIComponent(orgId)}` : ""}`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ name: form.get("name"), email: form.get("email") }),
          },
        ).catch(() => null);
        setBusy(false);
        if (response?.ok) {
          const { token } = (await response.json()) as { token: string };
          router.push(`/apply/${token}`);
          return;
        }
        const failure = (await response?.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        setError(failure?.error?.message ?? "Could not start. Try again.");
      }}
      noValidate
    >
      {error && <Notice tone="critical">{error}</Notice>}
      <Field label="Your name" required>
        <Input name="name" autoComplete="name" required autoFocus />
      </Field>
      <Field label="Email" required hint="We use this to reach you about your application.">
        <Input name="email" type="email" autoComplete="email" required />
      </Field>
      <Button type="submit" variant="primary" size="lg" loading={busy} className="w-full">
        Start application
      </Button>
      <p className="text-sm text-ink-subtle">
        The next page is yours to come back to — keep its link.
      </p>
    </form>
  );
}
