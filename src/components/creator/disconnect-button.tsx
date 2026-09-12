"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/states";

/** Ends the platform's side of the grant. The creator's public profile stays. */
export function DisconnectButton({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  async function run() {
    setBusy(true);
    setFailed(false);
    try {
      const response = await fetch("/api/internal/connect/youtube/disconnect", {
        method: "POST",
      });
      if (!response.ok) throw new Error(String(response.status));
      setOpen(false);
      router.refresh();
    } catch {
      // Close so the inline alert is not hidden behind the modal.
      setFailed(true);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)} disabled={disabled}>
        Disconnect
      </Button>
      {failed && (
        <Notice tone="critical" className="basis-full">
          The disconnect request did not complete. Your grant is unchanged — try again.
        </Notice>
      )}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Disconnect YouTube?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" onClick={run} loading={busy}>
              Disconnect
            </Button>
          </>
        }
      >
        <p className="text-base text-ink-muted">
          Your public profile stays; your authorized analytics stop refreshing. You can
          reconnect at any time.
        </p>
      </Dialog>
    </>
  );
}
