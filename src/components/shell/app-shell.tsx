"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/class-names";
import type { Permission, SessionUser } from "@/lib/contracts/auth";
import { ROLE_PERMISSIONS, ROLE_WORKSPACE } from "@/lib/contracts/auth";
import type { SearchQuota } from "@/lib/contracts/search";
import { visibleNav, WORKSPACE_HOME } from "@/lib/navigation";
import { Sheet } from "@/components/ui/dialog";
import { Wordmark } from "./logo";
import { Sidebar, SidebarNav } from "./sidebar";
import { Topbar } from "./topbar";
import { CommandPalette } from "./command-palette";

const COLLAPSE_KEY = "socialorbit.nav.collapsed";
const COLLAPSE_EVENT = "socialorbit:nav-collapse";

/**
 * The sidebar preference lives in localStorage, which the server cannot read.
 * `useSyncExternalStore` takes a separate server snapshot, so the first render
 * matches on both sides and the stored value applies immediately afterwards —
 * without the extra render pass a mount effect would cost.
 */
function useCollapsedPreference(): boolean {
  return React.useSyncExternalStore(
    (onChange) => {
      window.addEventListener(COLLAPSE_EVENT, onChange);
      window.addEventListener("storage", onChange);
      return () => {
        window.removeEventListener(COLLAPSE_EVENT, onChange);
        window.removeEventListener("storage", onChange);
      };
    },
    () => {
      try {
        return window.localStorage.getItem(COLLAPSE_KEY) === "1";
      } catch {
        return false;
      }
    },
    () => false,
  );
}

export function AppShell({
  user,
  quota,
  unreadCount,
  children,
}: {
  user: SessionUser;
  quota?: SearchQuota | null;
  unreadCount?: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const collapsed = useCollapsedPreference();
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);

  const toggleCollapsed = React.useCallback(() => {
    try {
      const next = window.localStorage.getItem(COLLAPSE_KEY) === "1" ? "0" : "1";
      window.localStorage.setItem(COLLAPSE_KEY, next);
    } catch {
      /* storage unavailable — the preference simply is not remembered */
    }
    // Notify this tab; the storage event only fires in *other* tabs.
    window.dispatchEvent(new Event(COLLAPSE_EVENT));
  }, []);

  // Close the drawer whenever the route changes, including on back/forward.
  // Reset during render rather than in an effect: an effect would paint the
  // new route with the drawer still open, then close it on a second pass.
  const [drawerRoute, setDrawerRoute] = React.useState(pathname);
  if (drawerRoute !== pathname) {
    setDrawerRoute(pathname);
    setDrawerOpen(false);
  }

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (typing) return;

      if (event.key === "/" || ((event.metaKey || event.ctrlKey) && event.key === "k")) {
        event.preventDefault();
        setPaletteOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const permissions = React.useMemo(
    () => new Set<Permission>(ROLE_PERMISSIONS[user.role]),
    [user.role],
  );
  const can = React.useCallback(
    (permission: Permission) => permissions.has(permission),
    [permissions],
  );

  const workspace = ROLE_WORKSPACE[user.role];
  const sections = React.useMemo(() => visibleNav(workspace, can), [workspace, can]);

  return (
    <div className="flex min-h-dvh">
      <a
        href="#main"
        className="sr-only-focusable absolute left-3 top-3 z-50 rounded-lg bg-brand px-3 py-2 text-[13px] font-medium text-white"
      >
        Skip to content
      </a>

      <Sidebar
        sections={sections}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        homeHref={WORKSPACE_HOME[workspace]}
      />

      <Sheet open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Navigation">
        <div className="px-2 pt-2">
          <Link
            href={WORKSPACE_HOME[workspace]}
            className="block rounded px-2 py-1"
            aria-label="SocialOrbit home"
          >
            <Wordmark />
          </Link>
        </div>
        <SidebarNav
          sections={sections}
          collapsed={false}
          onNavigate={() => setDrawerOpen(false)}
        />
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          user={user}
          quota={quota}
          unreadCount={unreadCount}
          onOpenNav={() => setDrawerOpen(true)}
          onOpenSearch={() => setPaletteOpen(true)}
        />
        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} can={can} />
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Page chrome shared by every screen inside the shell.
 * ------------------------------------------------------------------------ */

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  meta,
  className,
  titleAs = "h1",
}: {
  /**
   * Optional. A page that carries its own heading lower down — the influencer
   * profile puts it in the header card — omits this so the name is not printed
   * twice, and the breadcrumb alone carries the location.
   */
  title?: React.ReactNode;
  /** Yields the level-1 heading to a page that renders its own. */
  titleAs?: "h1" | "p";
  description?: React.ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
  actions?: React.ReactNode;
  /** Right-aligned freshness or status line under the actions. */
  meta?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("border-b border-line bg-surface px-4 py-4 sm:px-6", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        // The gap belongs between the strip and a title, not after a
        // breadcrumb-only header — there it just made the header bottom-heavy.
        <nav
          aria-label="Breadcrumb"
          className={title !== undefined || actions || meta ? "mb-1.5" : undefined}
        >
          <ol className="flex flex-wrap items-center gap-1 text-[12px] text-ink-muted">
            {breadcrumbs.map((crumb, index) => (
              <li key={`${crumb.label}-${index}`} className="flex items-center gap-1">
                {index > 0 && (
                  <span aria-hidden className="text-ink-subtle">
                    /
                  </span>
                )}
                {crumb.href ? (
                  <Link href={crumb.href} className="rounded hover:text-ink hover:underline">
                    {crumb.label}
                  </Link>
                ) : (
                  <span aria-current="page" className="text-ink">
                    {crumb.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 empty:hidden">
        <div className="min-w-0 space-y-1">
          {title !== undefined &&
            React.createElement(
              titleAs,
              {
                className:
                  "text-[21px] font-bold leading-tight tracking-[-0.028em] text-ink",
              },
              title,
            )}
          {description && (
            <p className="max-w-2xl text-[13px] leading-5 text-ink-muted">{description}</p>
          )}
        </div>
        {(actions || meta) && (
          // Never `shrink-0`: on a phone the action row is wider than the
          // viewport, and a rigid block there pushes the whole page sideways.
          <div className="flex min-w-0 max-w-full flex-col items-start gap-1.5 sm:items-end">
            {actions && (
              <div className="flex max-w-full flex-wrap items-center gap-2 sm:justify-end">
                {actions}
              </div>
            )}
            {meta && <div className="max-w-full">{meta}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

export function PageBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-4 py-4 sm:px-6 sm:py-5", className)} {...props} />;
}
