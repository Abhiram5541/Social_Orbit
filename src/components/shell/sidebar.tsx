"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/class-names";
import { isActive, type NavSection } from "@/lib/navigation";
import { Tooltip } from "@/components/ui/overlay";
import { Wordmark, OrbitMark } from "./logo";

/* ---------------------------------------------------------------------------
 * Primary navigation.
 *
 * Light chrome by explicit decision: the score readout stays the product's
 * one dark surface, so it keeps its weight. The active item carries a cobalt
 * rail — the accent spent on exactly one place in the chrome, where you are.
 *
 * Three responsive shapes rather than one shrunk layout:
 *   ≥ lg   full 240px rail with section labels
 *   ≥ lg   collapsed 64px icon rail (user preference, remembered)
 *   < lg   a drawer, rendered by AppShell — not this component
 * ------------------------------------------------------------------------ */

type Tone = "instrument" | "light";

const ITEM: Record<Tone, { idle: string; active: string; icon: string; iconActive: string }> = {
  instrument: {
    idle: "text-instrument-muted hover:bg-instrument-raised hover:text-instrument-ink",
    active: "bg-instrument-raised text-instrument-ink",
    icon: "text-instrument-muted/70 group-hover:text-instrument-muted",
    iconActive: "text-brand-glow",
  },
  light: {
    idle: "text-ink-muted hover:bg-sunken hover:text-ink",
    active: "bg-brand-soft text-brand-ink",
    icon: "text-ink-subtle group-hover:text-ink-muted",
    iconActive: "text-brand",
  },
};

export function SidebarNav({
  sections,
  collapsed,
  onNavigate,
  tone = "light",
}: {
  sections: NavSection[];
  collapsed: boolean;
  /** Lets the mobile drawer close itself when a destination is chosen. */
  onNavigate?: () => void;
  /** Kept for the one surface that may diverge; both default light today. */
  tone?: Tone;
}) {
  const pathname = usePathname();
  const t = ITEM[tone];

  return (
    <nav aria-label="Primary" className="flex flex-col gap-4 px-2 py-3">
      {sections.map((section, index) => (
        <div key={section.label ?? index} className="flex flex-col gap-0.5">
          {section.label && !collapsed && (
            <span
              className={cn(
                "label-caps px-2 pb-1 pt-1 text-[10px]",
                tone === "instrument" ? "text-instrument-muted" : "text-ink-subtle",
              )}
            >
              {section.label}
            </span>
          )}
          {section.label && collapsed && index > 0 && (
            <div
              className={cn(
                "mx-2 mb-1 h-px",
                tone === "instrument" ? "bg-instrument-line" : "bg-line",
              )}
              role="separator"
            />
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
                  "group relative flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] font-medium transition-colors",
                  collapsed && "justify-center px-0 py-2",
                  active ? t.active : t.idle,
                )}
              >
                {/* The active rail: cobalt spent on exactly one place in the
                    chrome — where you are. */}
                {active && !collapsed && (
                  <span
                    aria-hidden
                    className={cn(
                      "absolute inset-y-1 left-0 w-0.5 rounded-full",
                      tone === "instrument" ? "bg-brand-glow" : "bg-brand",
                    )}
                  />
                )}
                <item.icon
                  className={cn("size-4 shrink-0", active ? t.iconActive : t.icon)}
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
}: {
  sections: NavSection[];
  collapsed: boolean;
  onToggleCollapsed: () => void;
  homeHref: string;
}) {
  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col border-r border-line bg-surface lg:flex",
        collapsed ? "w-sidebar-rail" : "w-sidebar",
      )}
    >
      <div
        className={cn(
          "flex h-topbar shrink-0 items-center border-b border-line",
          collapsed ? "justify-center px-0" : "px-3",
        )}
      >
        <Link href={homeHref} className="rounded" aria-label="SocialOrbit home">
          {collapsed ? <OrbitMark /> : <Wordmark />}
        </Link>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin]">
        <SidebarNav sections={sections} collapsed={collapsed} />
      </div>

      <div
        className={cn(
          "border-t border-line p-2",
          collapsed && "flex justify-center",
        )}
      >
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          aria-pressed={collapsed}
          className={cn(
            "flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] font-medium text-ink-muted transition-colors hover:bg-sunken hover:text-ink",
            collapsed ? "justify-center" : "w-full",
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4" aria-hidden />
          ) : (
            <>
              <PanelLeftClose className="size-4" aria-hidden />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
