"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronDown,
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

/* ---------------------------------------------------------------------------
 * Navigation.
 *
 * An icon rail beside the page (`IconRail`) plus the topbar's tab strip at
 * `lg` and above; the labelled list (`SidebarNav`) in a drawer below it. The
 * one place colour appears in the chrome is the active route, a filled green
 * circle or pill — so a glance says where you are before a label is read.
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
            <span className="label-caps-sm px-3 pb-2 text-ink-subtle">
              {section.label}
            </span>
          )}
          {section.label && collapsed && index > 0 && (
            <div className="mx-3 mb-2 h-px bg-line" role="separator" />
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
                  "press group relative flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-base",
                  collapsed && "size-10 justify-center px-0",
                  active
                    ? "bg-brand font-semibold text-white shadow-brand"
                    : "font-medium text-ink-muted hover:bg-brand-softer hover:text-brand-ink",
                )}
              >
                <item.icon
                  className={cn(
                    "size-[1.125rem] shrink-0 transition-colors",
                    active ? "text-white" : "text-ink-subtle group-hover:text-brand-ink",
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

/**
 * The rail: every destination as an icon in a white pill column beside the
 * page. Groups are separated by a gap rather than a label — the label is the
 * tooltip. The active icon is the one filled green circle on the screen.
 */
export function IconRail({
  sections,
  className,
}: {
  sections: NavSection[];
  className?: string;
}) {
  const pathname = usePathname();

  return (
    <>
      {/* Holds the rail's column in the flow; the rail itself is fixed. */}
      <div aria-hidden className="hidden w-16 shrink-0 lg:block" />
      <aside
        aria-label="Navigation rail"
        // Fixed to the viewport, not sticky: sticky depends on the rail being
        // shorter than the window and on its containing block, and the
        // platform workspace's fifteen icons broke both on a short screen.
        // Left edge follows the centred frame; height fills the window under
        // the topbar; a long list scrolls inside the pill, scrollbar hidden.
        className={cn(
          "fixed top-[6.75rem] left-[max(1.75rem,calc((100vw-105rem)/2+1rem))] z-20 hidden h-[calc(100dvh-7.5rem)] w-16 flex-col items-center gap-3 overflow-y-auto rounded-full bg-surface py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:flex",
          className,
        )}
      >
      {sections.map((section, index) => (
        <div key={section.label ?? index} className="flex shrink-0 flex-col items-center gap-0.5">
          {section.items.map((item) => {
            const active = isActive(item, pathname);
            return (
              <Tooltip key={item.href} content={item.label} side="right">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "press grid size-10 place-items-center rounded-full",
                    active
                      ? "bg-brand text-white shadow-brand"
                      : "text-ink-subtle hover:bg-sunken hover:text-ink",
                  )}
                >
                  <item.icon className="size-[1.125rem]" aria-hidden />
                  <span className="sr-only">{item.label}</span>
                </Link>
              </Tooltip>
            );
          })}
        </div>
      ))}
      <div className="flex shrink-0 flex-col items-center border-t border-rule pt-2">
        <form action="/api/internal/auth/logout" method="post">
          <Tooltip content="Sign out" side="right">
            <button
              type="submit"
              className="press grid size-10 place-items-center rounded-full text-ink-subtle hover:bg-critical-soft hover:text-critical"
            >
              <LogOut className="size-[1.125rem]" aria-hidden />
              <span className="sr-only">Sign out</span>
            </button>
          </Tooltip>
        </form>
      </div>
      </aside>
    </>
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
            className="press flex w-full items-center gap-2.5 rounded-lg bg-sunken px-2.5 py-2 text-left hover:bg-sunken-strong"
          >
            <span
              aria-hidden
              className="grid size-8 shrink-0 place-items-center rounded-sm bg-instrument font-display text-sm font-bold text-instrument-ink"
            >
              {user.orgName.slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base font-semibold text-ink">
                {user.orgName}
              </span>
              <span className="label-caps-sm block truncate text-ink-subtle">
                {user.orgKind === "platform" ? "Platform" : plan.label}
              </span>
            </span>
            <ChevronDown className="size-3.5 shrink-0 text-ink-subtle" aria-hidden />
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

/** Who is signed in, and the way out. Sits at the foot of the rail. */
export function AccountMenu({
  user,
  collapsed,
  chevron = false,
}: {
  user: SessionUser;
  collapsed: boolean;
  /** Avatar with a small chevron beside it — the topbar trigger. */
  chevron?: boolean;
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
      // In the topbar the trigger sits at the far right, so the menu hangs
      // from its end edge and opens downward; in the drawer's foot it opens
      // upward from the start edge, as before.
      align={chevron ? "end" : "start"}
      side={chevron ? "bottom" : "top"}
      trigger={(props) => (
        <button
          type="button"
          {...props}
          aria-label={collapsed ? `Account: ${user.name}` : undefined}
          className={cn(
            "press flex w-full items-center gap-2.5 text-left",
            collapsed
              ? chevron
                ? "h-10 rounded-full pl-0 pr-1"
                : "size-10 justify-center rounded-full px-0 py-0"
              : "rounded-md px-2 py-1.5 hover:bg-sunken",
          )}
        >
          <Avatar name={user.name} src={user.avatarUrl} size={chevron ? "md" : "sm"} />
          {collapsed && chevron && (
            <ChevronDown className="size-3.5 shrink-0 text-ink-subtle" aria-hidden />
          )}
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-medium text-ink">
                  {user.name}
                </span>
                <span className="block truncate text-xs text-ink-subtle">
                  {ROLE_LABEL[user.role]}
                </span>
              </span>
              <ChevronDown className="size-3.5 shrink-0 text-ink-subtle" aria-hidden />
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
