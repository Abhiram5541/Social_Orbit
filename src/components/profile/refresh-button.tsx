"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Re-reads this creator from the platform.
 *
 * There is no scheduler yet, so nothing refreshes on its own — this is the
 * only way a profile moves between operator ingests, and the only way a growth
 * history accumulates, since each refresh appends a snapshot.
 *
 * The cooldown lives on the server, not here: hiding the button would be a
 * convenience, and the shared quota it protects needs a control.
 */
export function RefreshButton({ influencerId }: { influencerId: string }) {
  const router = useRouter();
  const [state, setState] = React.useState<
    { status: "idle" | "loading" } | { status: "done" | "error"; message: string }
  >({ status: "idle" });

  async function refresh() {
    setState({ status: "loading" });
    try {
      const response = await fetch(`/api/internal/influencers/${influencerId}/refresh`, {
        method: "POST",
      });
      const body = await response.json();

      if (!response.ok) {
        setState({
          status: "error",
          message: body?.error?.message ?? "The refresh could not be completed.",
        });
        return;
      }

      setState({
        status: "done",
        message: `Updated — ${body.contentIndexed} uploads re-read.`,
      });
      // The page is server-rendered from the store this write just changed.
      router.refresh();
    } catch {
      setState({ status: "error", message: "The refresh request could not be sent." });
    }
  }

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <Button
        size="sm"
        variant="secondary"
        onClick={refresh}
        loading={state.status === "loading"}
      >
        <RefreshCw className="size-3.5" aria-hidden />
        Refresh data
      </Button>

      {(state.status === "done" || state.status === "error") && (
        <p
          role="status"
          className={`max-w-xs text-[11px] leading-4 ${
            state.status === "error" ? "text-critical" : "text-positive"
          }`}
        >
          {state.message}
        </p>
      )}
    </div>
  );
}
