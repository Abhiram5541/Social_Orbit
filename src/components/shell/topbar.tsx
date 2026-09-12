"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, HelpCircle, Menu, Search } from "lucide-react";
import { cn } from "@/lib/class-names";
import { ROLE_WORKSPACE, type SessionUser } from "@/lib/contracts/auth";
import type { SearchQuota } from "@/lib/contracts/search";

/* ---------------------------------------------------------------------------
 * The topbar carries the page, not the account.
 *
 * Identity, workspace and the account menu moved into the rail, where they
 * belong to the housing rather than to whatever screen is open. What is left
 * is the one control every route shares — the command palette — and the two
 * status affordances that are genuinely global: remaining search allowance,
 * which a free-plan client must see *before* spending a search, and the
 * notification count.
 *
 * It stays graphite, continuous with the rail: the chrome is one material
 * wrapping the paper the analysis is printed on.
 * ------------------------------------------------------------------------ */

/**
 * `⌘` on Apple hardware, `Ctrl` everywhere else — resolved through
 * `useSyncExternalStore` so the server renders a stable snapshot and React
 * never reports a hydration mismatch for a value the server cannot know.
 */
function useCommandKey(): string {
  return React.useSyncExternalStore(
    () => () => {},
    () => (/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl"),
    () => "Ctrl",
  );
}

export function Topbar({
  user,
  quota,
  onOpenNav,
  onOpenSearch,
  unreadCount = 0,
}: {
  user: SessionUser;
  quota?: SearchQuota | null;
  onOpenNav: () => void;
  onOpenSearch: () => void;
  unreadCount?: number;
}) {
  const commandKey = useCommandKey();
  const workspace = ROLE_WORKSPACE[user.role];

  return (
    <header className="bg-instrument sticky top-0 z-30 flex h-topbar shrink-0 items-center gap-2 px-3">
      <button
        type="button"
        onClick={onOpenNav}
        aria-label="Open navigation"
        className="press grid size-9 shrink-0 place-items-center rounded-md text-instrument-muted hover:bg-instrument-raised hover:text-instrument-ink lg:hidden"
      >
        <Menu className="size-4.5" aria-hidden />
      </button>

      {/* The trigger looks like an input but is a button — it opens a palette,
          it does not accept typing in place. */}
      <button
        type="button"
        onClick={onOpenSearch}
        className={cn(
          "press group flex h-9 min-w-0 flex-1 items-center gap-2.5 rounded-md bg-instrument-raised px-3",
          "text-left text-base text-instrument-muted shadow-chrome-raised",
          "hover:bg-instrument-line hover:text-instrument-ink",
          "sm:max-w-xl",
        )}
      >
        <Search className="size-4 shrink-0" aria-hidden />
        {/* States what the palette can actually do — creator search across the
            indexed database, and page jumps. It does not claim a natural
            language layer the product has not built. */}
        <span className="truncate">
          Search creators<span className="hidden md:inline"> across the SocialOrbit database</span>,
          or jump to a page
        </span>
        <kbd className="ml-auto hidden shrink-0 items-center gap-0.5 rounded border border-instrument-line-strong px-1.5 py-0.5 font-num text-2xs font-medium text-instrument-muted sm:flex">
          {commandKey}
          <span className="font-sans">K</span>
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1">
        {quota?.limit !== null && quota !== undefined && quota !== null && (
          <QuotaChip quota={quota} />
        )}

        <Link
          href="/help"
          aria-label="Help and documentation"
          className="press hidden size-9 place-items-center rounded-md text-instrument-muted hover:bg-instrument-raised hover:text-instrument-ink sm:grid"
        >
          <HelpCircle className="size-4.5" aria-hidden />
        </Link>

        <Link
          href={workspace === "influencer" ? "/creator/notifications" : "/notifications"}
          aria-label={
            unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"
          }
          className="press relative grid size-9 place-items-center rounded-md text-instrument-muted hover:bg-instrument-raised hover:text-instrument-ink"
        >
          <Bell className="size-4.5" aria-hidden />
          {unreadCount > 0 && (
            <span className="absolute right-1.5 top-1.5 size-2 rounded-full border-2 border-instrument bg-brand-lift" />
          )}
        </Link>
      </div>
    </header>
  );
}

/**
 * Remaining search allowance. Free-plan clients need to see this before they
 * spend a search, not after they are blocked — Arch §3.
 *
 * The bar is the point: a count alone makes a person do the division. Under
 * the last fifth it turns amber, and at zero it turns rose, so the state is
 * legible without reading either number.
 */
function QuotaChip({ quota }: { quota: SearchQuota }) {
  if (quota.limit === null || quota.remaining === null) return null;
  const exhausted = quota.remaining <= 0;
  const low = quota.remaining <= Math.max(1, Math.floor(quota.limit * 0.2));
  const used = Math.min(100, Math.max(0, ((quota.limit - quota.remaining) / quota.limit) * 100));

  return (
    <Link
      href="/usage"
      className="press hidden items-center gap-2 rounded-md px-2 py-1.5 hover:bg-instrument-raised sm:inline-flex"
      aria-label={`${quota.remaining} of ${quota.limit} searches remaining this month`}
    >
      <span className="label-caps-sm text-instrument-muted">Searches</span>
      <span aria-hidden className="h-1 w-12 overflow-hidden rounded-full bg-instrument-line-strong">
        <span
          className={cn(
            "block h-full rounded-full transition-[width]",
            exhausted ? "bg-critical-lift" : low ? "bg-caution-lift" : "bg-brand-lift",
          )}
          style={{ width: `${used}%` }}
        />
      </span>
      <span
        className={cn(
          "font-num text-sm font-medium",
          exhausted
            ? "text-critical-lift"
            : low
              ? "text-caution-lift"
              : "text-instrument-ink",
        )}
      >
        {quota.remaining}
      </span>
    </Link>
  );
}
