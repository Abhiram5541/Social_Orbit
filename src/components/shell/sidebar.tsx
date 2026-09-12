"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  CreditCard,
  LogOut,
  Settings,
  Users,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/class-names";
import { isActive, type NavSection } from "@/lib/navigation";
import {
  PLAN_CONFIG,
  ROLE_LABEL,
  ROLE_WORKSPACE,
  type SessionUser,
} from "@/lib/contracts/auth";
import { Avatar } from "@/components/ui/avatar";
import { Tooltip, Menu as PopMenu, MenuItem, MenuLabel, MenuSeparator } from "@/components/ui/overlay";
import { Wordmark, OrbitMark } from "./logo";

/* ---------------------------------------------------------------------------
 * Primary navigation — the instrument housing.
 *
 * The rail and the topbar are graphite; the work canvas is warm paper set
 * inside them. That inversion is the product's identity, and it is why the
 * chrome is the one place the dark material appears on every route rather
 * than on a single card.
 *
 * Three things live here, in the order a person needs them:
 *
 *   Identity    which organisation's data this is, and on what plan
 *   Navigation  grouped by intent, active item raised out of the housing
 *   Account     who is signed in, and the way out
 *
 * Putting identity and account in the rail empties the topbar of everything
 * that is not about the page in front of you — which is what makes the topbar
 * able to carry page context instead of a second row of chrome.
 *
 * Three responsive shapes rather than one shrunk layout:
 *   ≥ lg   full 248px rail with section labels
 *   ≥ lg   collapsed 68px icon rail (user preference, remembered)
 *   < lg   a drawer, rendered by AppShell — not this component
 * ------------------------------------------------------------------------ */

export function SidebarNav({
  sections,
  collapsed,
  onNavigate,
}: {
  sections: NavSection[];
  collapsed: boolean;
  /** Lets the mobile drawer close itself when a destination is chosen. */
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="flex flex-col gap-6 px-3 py-4">
      {sections.map((section, index) => (
        <div key={section.label ?? index} className="flex flex-col gap-0.5">
          {section.label && !collapsed && (
            <span className="label-caps-sm px-2.5 pb-2 text-instrument-muted">
              {section.label}
            </span>
          )}
          {section.label && collapsed && index > 0 && (
            <div className="mx-3 mb-2 h-px bg-instrument-line" role="separator" />
          )}
          {section.items.map((item) => {
            const active = isActive(item, pathname);
            const link = (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                onClick={onNavigate}
                className={cn(
                  "press group relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-base",
                  collapsed && "justify-center px-0",
                  active
                    ? "bg-instrument-raised font-semibold text-instrument-ink shadow-chrome-raised"
                    : "font-medium text-instrument-muted hover:bg-instrument-raised/60 hover:text-instrument-ink",
                )}
              >
                {/* The cobalt edge: the accent spent on exactly one place in
                    the chrome — where you are. */}
                {active && (
                  <span
                    aria-hidden
                    className={cn(
                      "absolute rounded-full bg-brand-lift",
                      collapsed ? "inset-y-2 left-0 w-0.5" : "inset-y-1.5 -left-px w-0.5",
                    )}
                  />
                )}
                <item.icon
                  className={cn(
                    "size-4 shrink-0 transition-colors",
                    active
                      ? "text-brand-lift"
                      : "text-instrument-subtle group-hover:text-instrument-muted",
                  )}
                  aria-hidden
                />
                {!collapsed && <span className="truncate">{item.label}</span>}
                {collapsed && <span className="sr-only">{item.label}</span>}
              </Link>
            );

            // A rail with no labels needs its names available on hover and focus.
            return collapsed ? (
              <Tooltip key={item.href} content={item.label} side="right">
                {link}
              </Tooltip>
            ) : (
              link
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function Sidebar({
  sections,
  collapsed,
  onToggleCollapsed,
  homeHref,
  user,
}: {
  sections: NavSection[];
  collapsed: boolean;
  onToggleCollapsed: () => void;
  homeHref: string;
  user: SessionUser;
}) {
  return (
    <aside
      className={cn(
        "instrument-scroll bg-instrument hidden shrink-0 flex-col lg:flex",
        collapsed ? "w-sidebar-rail" : "w-sidebar",
      )}
    >
      <div
        className={cn(
          "flex h-topbar shrink-0 items-center",
          collapsed ? "justify-center px-0" : "px-4",
        )}
      >
        <Link href={homeHref} className="rounded" aria-label="SocialOrbit home">
          {collapsed ? <OrbitMark /> : <Wordmark inverse />}
        </Link>
      </div>

      {!collapsed && <OrgBlock user={user} />}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <SidebarNav sections={sections} collapsed={collapsed} />
      </div>

      <div className="shrink-0 border-t border-instrument-line p-3">
        <AccountMenu user={user} collapsed={collapsed} />
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          aria-pressed={collapsed}
          className={cn(
            "press mt-1 flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium",
            "text-instrument-subtle hover:bg-instrument-raised hover:text-instrument-ink",
            collapsed ? "w-full justify-center px-0" : "w-full",
          )}
        >
          {collapsed ? (
            <ChevronsRight className="size-4" aria-hidden />
          ) : (
            <>
              <ChevronsLeft className="size-4" aria-hidden />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}

/**
 * Whose data this is.
 *
 * Deliberately *not* a switcher: a session belongs to exactly one
 * organisation, and a dropdown offering one option is theatre. It names the
 * workspace being read and opens onto the things you would go there to do —
 * which is what a switcher is a route to anyway.
 */
export function OrgBlock({ user }: { user: SessionUser }) {
  const router = useRouter();
  const workspace = ROLE_WORKSPACE[user.role];
  const plan = PLAN_CONFIG[user.plan];

  return (
    <div className="px-3 pb-1">
      <PopMenu
        align="start"
        trigger={(props) => (
          <button
            type="button"
            {...props}
            className="press flex w-full items-center gap-2.5 rounded-lg bg-instrument-raised px-2.5 py-2 text-left shadow-chrome-raised hover:bg-instrument-line"
          >
            <span
              aria-hidden
              className="grid size-7 shrink-0 place-items-center rounded-md bg-instrument-line-strong font-display text-sm font-bold text-instrument-ink"
            >
              {user.orgName.slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base font-semibold text-instrument-ink">
                {user.orgName}
              </span>
              <span className="label-caps-sm block truncate text-instrument-muted">
                {user.orgKind === "platform" ? "Platform" : plan.label}
              </span>
            </span>
            <ChevronDown className="size-3.5 shrink-0 text-instrument-muted" aria-hidden />
          </button>
        )}
      >
        <MenuLabel>Workspace</MenuLabel>
        <div className="px-2 pb-2">
          <p className="truncate text-base font-semibold text-ink">{user.orgName}</p>
          <p className="mt-0.5 text-sm text-ink-muted">
            {user.orgKind === "platform" ? "SocialOrbit platform" : "Client organisation"}
            <span aria-hidden> · </span>
            <span className="text-ink">{plan.label} plan</span>
          </p>
        </div>
        {workspace === "client" && (
          <>
            <MenuSeparator />
            <MenuItem onClick={() => router.push("/settings")}>
              <Users className="size-3.5" aria-hidden />
              Members and roles
            </MenuItem>
            <MenuItem onClick={() => router.push("/usage")}>
              <CreditCard className="size-3.5" aria-hidden />
              Usage and billing
            </MenuItem>
          </>
        )}
        {workspace === "admin" && (
          <>
            <MenuSeparator />
            <MenuItem onClick={() => router.push("/admin/orgs")}>
              <Building2 className="size-3.5" aria-hidden />
              Client organisations
            </MenuItem>
            <MenuItem onClick={() => router.push("/admin/users")}>
              <Users className="size-3.5" aria-hidden />
              Platform users
            </MenuItem>
          </>
        )}
      </PopMenu>
    </div>
  );
}

/** Who is signed in, and the way out. Sits at the foot of the housing. */
export function AccountMenu({
  user,
  collapsed,
}: {
  user: SessionUser;
  collapsed: boolean;
}) {
  const router = useRouter();
  const workspace = ROLE_WORKSPACE[user.role];
  const settingsHref =
    workspace === "admin"
      ? "/admin/settings"
      : workspace === "influencer"
        ? "/creator/settings"
        : "/settings";

  return (
    <PopMenu
      align="start"
      side="top"
      trigger={(props) => (
        <button
          type="button"
          {...props}
          aria-label={collapsed ? `Account: ${user.name}` : undefined}
          className={cn(
            "press flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left",
            "hover:bg-instrument-raised",
            collapsed && "justify-center px-0",
          )}
        >
          <Avatar name={user.name} src={user.avatarUrl} size="sm" />
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-medium text-instrument-ink">
                  {user.name}
                </span>
                <span className="block truncate text-xs text-instrument-muted">
                  {ROLE_LABEL[user.role]}
                </span>
              </span>
              <ChevronDown className="size-3.5 shrink-0 text-instrument-muted" aria-hidden />
            </>
          )}
        </button>
      )}
    >
      <MenuLabel>{user.email}</MenuLabel>
      <MenuSeparator />
      <MenuItem onClick={() => router.push(settingsHref)}>
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
  );
}
