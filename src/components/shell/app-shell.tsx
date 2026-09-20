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
import { AccountMenu, IconRail, OrgBlock, SidebarNav } from "./sidebar";
import { Topbar } from "./topbar";
import { CommandPalette } from "./command-palette";

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
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const searchRef = React.useRef<HTMLButtonElement>(null);

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
  // The topbar strip: the first five destinations in reading order. The rail
  // carries all of them.
  const tabs = React.useMemo(
    () => sections.flatMap((section) => section.items).slice(0, 5),
    [sections],
  );

  return (
    // The shell: a rounded frame set on the page ground, the way the
    // reference frames its whole application as one object.
    <div className="min-h-dvh bg-ground p-2 sm:p-3">
      <a
        href="#main"
        className="sr-only-focusable absolute left-3 top-3 z-50 rounded-full bg-brand px-4 py-2 text-base font-semibold text-white"
      >
        Skip to content
      </a>

      {/* The drawer is the rail: on a phone it carries the same wordmark,
          org block and account foot, in the same white. */}
      <Sheet
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Navigation"
      >
        <div className="flex h-full flex-col">
          <div className="px-4 pt-1">
            <Link
              href={WORKSPACE_HOME[workspace]}
              className="inline-block rounded-md py-1"
              aria-label="SENSO home"
            >
              <Wordmark />
            </Link>
          </div>
          <div className="pt-3">
            <OrgBlock user={user} />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <SidebarNav
              sections={sections}
              collapsed={false}
              onNavigate={() => setDrawerOpen(false)}
            />
          </div>
          <div className="shrink-0 border-t border-rule p-3">
            <AccountMenu user={user} collapsed={false} />
          </div>
        </div>
      </Sheet>

      <div className="mx-auto flex min-h-[calc(100dvh-1.5rem)] max-w-[1680px] flex-col gap-4 rounded-3xl bg-canvas px-3 pb-3 sm:px-4 sm:pb-4">
        {/* The sticky band carries the frame's top padding in the canvas
            colour, so scrolled content passes behind it rather than through
            the gap above the pill. */}
        <div className="sticky top-0 z-30 bg-canvas pt-3 sm:pt-4">
          <Topbar
            user={user}
            quota={quota}
            tabs={tabs}
            homeHref={WORKSPACE_HOME[workspace]}
            unreadCount={unreadCount}
            onOpenNav={() => setDrawerOpen(true)}
            onOpenSearch={() => setPaletteOpen(true)}
            searchRef={searchRef}
          />
        </div>
        <div className="flex min-w-0 flex-1 gap-4">
          <IconRail sections={sections} />
          <main id="main" className="min-w-0 flex-1 pb-4">
            {children}
          </main>
        </div>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        anchor={searchRef}
        can={can}
        quota={quota}
      />
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Page chrome shared by every screen inside the shell.
 * ------------------------------------------------------------------------ */

export function PageHeader({
  title,
  eyebrow,
  leadFigure,
  description,
  breadcrumbs,
  actions,
  meta,
  className,
  titleAs = "h1",
}: {
  /**
   * The section this screen belongs to.
   *
   * Rendered as the leading step of the breadcrumb trail rather than as a caps
   * label stacked over the title. A kicker above a heading is decoration — the
   * heading carries its own weight — but the same words used as the first
   * crumb are wayfinding, and they cost no vertical space.
   */
  eyebrow?: React.ReactNode;
  /**
   * Optional. A page that carries its own heading lower down — the influencer
   * profile puts it in the header card — omits this so the name is not printed
   * twice, and the breadcrumb alone carries the location.
   */
  title?: React.ReactNode;
  /** Yields the level-1 heading to a page that renders its own. */
  titleAs?: "h1" | "p";
  /**
   * The page's one headline number, set beside the title in the numeric voice
   * at a lighter weight — the bold-against-light pairing is the product's
   * typographic signature. Pass a formatted figure, e.g. "627 creators".
   */
  leadFigure?: React.ReactNode;
  description?: React.ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
  actions?: React.ReactNode;
  /** Right-aligned freshness or status line under the actions. */
  meta?: React.ReactNode;
  className?: string;
}) {
  const trail: { label: React.ReactNode; href?: string }[] = [
    ...(eyebrow ? [{ label: eyebrow }] : []),
    ...(breadcrumbs ?? []),
  ];

  return (
    <div className={cn("px-1 pb-5 pt-2 sm:px-2", className)}>
      {trail.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-2">
          <ol className="flex flex-wrap items-center gap-1.5 text-sm text-ink-subtle">
            {trail.map((crumb, index) => (
              <li key={index} className="flex items-center gap-1.5">
                {index > 0 && (
                  <span aria-hidden className="text-line-strong">
                    /
                  </span>
                )}
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="rounded font-medium hover:text-ink hover:underline"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span
                    aria-current={index === trail.length - 1 ? "page" : undefined}
                    className={cn(
                      "font-medium",
                      index === trail.length - 1 && trail.length > 1 && "text-ink-muted",
                    )}
                  >
                    {crumb.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-3 empty:hidden">
        <div className="min-w-0 space-y-1.5">
          {title !== undefined && (
            <div className="flex flex-wrap items-baseline gap-x-3">
              {React.createElement(
                titleAs,
                {
                  className:
                    "font-display text-title font-extrabold tracking-display text-ink sm:text-title-lg",
                },
                title,
              )}
              {leadFigure && (
                <span className="font-num text-stat-lg font-medium text-ink-subtle">
                  {leadFigure}
                </span>
              )}
            </div>
          )}
          {description && (
            <p className="measure text-base text-ink-muted">{description}</p>
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

/**
 * The screen's first analysis surface, directly under the header: one white
 * card holding the supporting figures. One card, not a tray of tiles — the
 * strip inside it divides with hairlines, so six figures read as one reading.
 */
export function PageBand({
  className,
  inset = true,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { inset?: boolean }) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl bg-surface card-shadow",
        inset && "px-4 sm:px-6",
        className,
      )}
      {...props}
    />
  );
}

export function PageBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-0 py-1 sm:px-1", className)} {...props} />;
}
