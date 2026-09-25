"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/states";

export function UnsubscribeForm({ token }: { token: string }) {
  const [state, setState] = React.useState<"idle" | "busy" | "done" | "error">("idle");

  async function confirm() {
    setState("busy");
    const response = await fetch("/api/public/unsubscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    }).catch(() => null);
    setState(response?.ok ? "done" : "error");
  }

  if (state === "done") {
    return (
      <div className="mt-6">
        <Notice tone="positive" title="Done">
          You have been removed. They cannot email you through SENSO again.
        </Notice>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-3">
      <Button onClick={confirm} disabled={state === "busy"}>
        {state === "busy" ? "Working…" : "Unsubscribe me"}
      </Button>
      {state === "error" && (
        <Notice tone="critical" title="Not done">
          Something went wrong. Reply to the email and ask them to stop.
        </Notice>
      )}
    </div>
  );
}
