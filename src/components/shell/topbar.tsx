"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, ChevronDown, HelpCircle, LogOut, Menu, Search, Settings } from "lucide-react";
import { cn } from "@/lib/class-names";
import { PLAN_CONFIG, ROLE_LABEL, ROLE_WORKSPACE, type SessionUser } from "@/lib/contracts/auth";
import type { SearchQuota } from "@/lib/contracts/search";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Menu as PopMenu, MenuItem, MenuLabel, MenuSeparator } from "@/components/ui/overlay";

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
  // Each workspace owns its own settings and inbox routes.
  const workspace = ROLE_WORKSPACE[user.role];
  const settingsHref =
    workspace === "admin"
      ? "/admin/settings"
      : workspace === "influencer"
        ? "/creator/settings"
        : "/settings";

  return (
    <header className="sticky top-0 z-30 flex h-topbar shrink-0 items-center gap-2 border-b border-line bg-surface/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
      <button
        type="button"
        onClick={onOpenNav}
        aria-label="Open navigation"
        className="grid size-9 shrink-0 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-sunken hover:text-ink lg:hidden"
      >
        <Menu className="size-4.5" aria-hidden />
      </button>

      {/* The trigger looks like an input but is a button — it opens a palette,
          it does not accept typing in place. */}
      <button
        type="button"
        onClick={onOpenSearch}
        className={cn(
          "group flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-canvas px-2.5",
          "text-left text-[13px] text-ink-subtle transition-colors hover:border-line-strong hover:bg-surface",
          "sm:max-w-md",
        )}
      >
        <Search className="size-4 shrink-0" aria-hidden />
        <span className="truncate">Search creators, campaigns, shortlists…</span>
        <kbd className="ml-auto hidden shrink-0 rounded border border-line bg-surface px-1 font-num text-[10px] text-ink-subtle sm:block">
          /
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1">
        {quota?.limit !== null && quota !== undefined && quota !== null && (
          <QuotaChip quota={quota} />
        )}

        <Link
          href={workspace === "influencer" ? "/creator/notifications" : "/notifications"}
          aria-label={
            unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"
          }
          className="relative grid size-9 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-sunken hover:text-ink"
        >
          <Bell className="size-4.5" aria-hidden />
          {unreadCount > 0 && (
            <span className="absolute right-1.5 top-1.5 size-2 rounded-full border-2 border-surface bg-brand" />
          )}
        </Link>

        <Link
          href="/help"
          aria-label="Help and documentation"
          className="hidden size-9 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-sunken hover:text-ink sm:grid"
        >
          <HelpCircle className="size-4.5" aria-hidden />
        </Link>

        <PopMenu
          trigger={(props) => (
            <button
              type="button"
              {...props}
              className="flex items-center gap-1.5 rounded-lg py-1 pl-1 pr-1.5 transition-colors hover:bg-sunken"
            >
              <Avatar name={user.name} src={user.avatarUrl} size="sm" />
              <span className="hidden min-w-0 flex-col items-start leading-tight md:flex">
                <span className="max-w-32 truncate text-[13px] font-medium text-ink">
                  {user.name}
                </span>
                <span className="max-w-32 truncate text-[11px] text-ink-muted">
                  {ROLE_LABEL[user.role]}
                </span>
              </span>
              <ChevronDown className="size-3.5 shrink-0 text-ink-subtle" aria-hidden />
            </button>
          )}
        >
          <MenuLabel>{user.orgName}</MenuLabel>
          <div className="px-2 pb-1.5">
            <p className="truncate text-[12px] text-ink-muted">{user.email}</p>
            <Badge tone="neutral" className="mt-1.5">
              {PLAN_CONFIG[user.plan].label} plan
            </Badge>
          </div>
          <MenuSeparator />
          <MenuItem onClick={() => (window.location.href = settingsHref)}>
            <Settings className="size-3.5" aria-hidden />
            Settings
          </MenuItem>
          <MenuSeparator />
          <form action="/api/internal/auth/logout" method="post">
            <MenuItem type="submit" destructive>
              <LogOut className="size-3.5" aria-hidden />
              Sign out
            </MenuItem>
          </form>
        </PopMenu>
      </div>
    </header>
  );
}

/**
 * Remaining search allowance. Free-plan clients need to see this before they
 * spend a search, not after they are blocked — Arch §3.
 */
function QuotaChip({ quota }: { quota: SearchQuota }) {
  if (quota.limit === null || quota.remaining === null) return null;
  const exhausted = quota.remaining <= 0;
  const low = quota.remaining <= Math.max(1, Math.floor(quota.limit * 0.2));

  return (
    <Link
      href="/usage"
      className="hidden items-center gap-1.5 rounded-lg border border-line px-2 py-1 text-[12px] transition-colors hover:bg-sunken sm:inline-flex"
      aria-label={`${quota.remaining} of ${quota.limit} searches remaining this month`}
    >
      <span className="text-ink-muted">Searches</span>
      <span
        className={cn(
          "font-num font-medium tabular-nums",
          exhausted ? "text-critical" : low ? "text-caution" : "text-ink",
        )}
      >
        {quota.remaining}/{quota.limit}
      </span>
    </Link>
  );
}
