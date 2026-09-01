"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/** Ends the platform's side of the grant. The creator's public profile stays. */
export function DisconnectButton({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function run() {
    setBusy(true);
    try {
      await fetch("/api/internal/connect/youtube/disconnect", { method: "POST" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="ghost" onClick={run} loading={busy} disabled={disabled}>
      Disconnect
    </Button>
  );
}
