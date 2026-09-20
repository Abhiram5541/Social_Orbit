"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Menu, Search } from "lucide-react";
import { cn } from "@/lib/class-names";
import { ROLE_WORKSPACE, type SessionUser } from "@/lib/contracts/auth";
import type { SearchQuota } from "@/lib/contracts/search";
import { isActive, type NavItem } from "@/lib/navigation";
import { Wordmark } from "./logo";
import { AccountMenu } from "./sidebar";

/* ---------------------------------------------------------------------------
 * The topbar: one white pill across the shell.
 *
 * Wordmark on the left, the primary destinations as a centred tab strip, and
 * on the right the round controls every route shares — search, alerts,
 * account. The rail beside the page carries the full navigation as icons;
 * this strip is the five places a person goes most.
 * ------------------------------------------------------------------------ */

export function Topbar({
  user,
  quota,
  tabs,
  homeHref,
  onOpenNav,
  onOpenSearch,
  searchRef,
  unreadCount = 0,
}: {
  user: SessionUser;
  quota?: SearchQuota | null;
  /** The primary destinations, drawn as a centred tab strip. */
  tabs: NavItem[];
  homeHref: string;
  onOpenNav: () => void;
  onOpenSearch: () => void;
  /** The search control, so the palette can open beneath it. */
  searchRef?: React.Ref<HTMLButtonElement>;
  unreadCount?: number;
}) {
  const pathname = usePathname();
  const workspace = ROLE_WORKSPACE[user.role];

  return (
    <header className="flex h-topbar shrink-0 items-center gap-3 rounded-full bg-surface pl-5 pr-3">
      <button
        type="button"
        onClick={onOpenNav}
        aria-label="Open navigation"
        className="press -ml-2 grid size-10 shrink-0 place-items-center rounded-full text-ink-muted hover:bg-sunken hover:text-ink lg:hidden"
      >
        <Menu className="size-4.5" aria-hidden />
      </button>

      {/* One node, not a phone/desktop pair: two nodes toggled by media
          rules render stacked the moment a stylesheet is stale. On a phone
          only the tagline is dropped. */}
      <Link href={homeHref} className="shrink-0 rounded-md" aria-label="SENSO home">
        <Wordmark className="[&_.label-caps-sm]:hidden sm:[&_.label-caps-sm]:block" />
      </Link>

      <nav aria-label="Primary" className="mx-auto hidden lg:block">
        <ul className="flex items-center gap-1 rounded-full bg-sunken p-1">
          {tabs.map((item) => {
            const active = isActive(item, pathname);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "press inline-flex h-9 items-center rounded-full px-4 text-base whitespace-nowrap",
                    active
                      ? "bg-surface font-semibold text-ink shadow-raised"
                      : "font-medium text-ink-muted hover:text-ink",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="ml-auto flex items-center gap-1.5 lg:ml-0">
        {quota?.limit !== null && quota !== undefined && quota !== null && (
          <QuotaChip quota={quota} />
        )}

        {/* Opens the palette — creator search across the database and page
            jumps. A round control rather than a field, as the reference. */}
        <button
          ref={searchRef}
          type="button"
          onClick={onOpenSearch}
          aria-label="Search creators — press /"
          className="press grid size-10 place-items-center rounded-full bg-sunken text-ink-muted hover:bg-sunken-strong hover:text-ink"
        >
          <Search className="size-4.5" aria-hidden />
        </button>

        <Link
          href={workspace === "influencer" ? "/creator/notifications" : "/notifications"}
          aria-label={
            unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"
          }
          className="press relative grid size-10 place-items-center rounded-full bg-sunken text-ink-muted hover:bg-sunken-strong hover:text-ink"
        >
          <Bell className="size-4.5" aria-hidden />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-critical px-1 font-num text-2xs font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Link>

        <div className="ml-1">
          <AccountMenu user={user} collapsed chevron />
        </div>
      </div>
    </header>
  );
}

/**
 * Remaining search allowance. Free-plan clients need to see this before they
 * spend a search, not after they are blocked — Arch §3. Under the last fifth
 * it turns amber, at zero rose.
 */
function QuotaChip({ quota }: { quota: SearchQuota }) {
  if (quota.limit === null || quota.remaining === null) return null;
  const exhausted = quota.remaining <= 0;
  const low = quota.remaining <= Math.max(1, Math.floor(quota.limit * 0.2));
  const used = Math.min(100, Math.max(0, ((quota.limit - quota.remaining) / quota.limit) * 100));

  return (
    <Link
      href="/usage"
      className="press mr-1 hidden h-10 items-center gap-2.5 rounded-full bg-sunken px-4 hover:bg-sunken-strong xl:inline-flex"
      aria-label={`${quota.remaining} of ${quota.limit} searches remaining this month`}
    >
      <span className="text-xs font-medium text-ink-subtle">Searches</span>
      <span aria-hidden className="h-1.5 w-12 overflow-hidden rounded-full bg-line-strong">
        <span
          className={cn(
            "block h-full rounded-full transition-[width]",
            exhausted ? "bg-critical" : low ? "bg-caution" : "bg-brand",
          )}
          style={{ width: `${used}%` }}
        />
      </span>
      <span
        className={cn(
          "font-num text-sm font-semibold",
          exhausted ? "text-critical" : low ? "text-caution" : "text-ink",
        )}
      >
        {quota.remaining}
      </span>
    </Link>
  );
}
