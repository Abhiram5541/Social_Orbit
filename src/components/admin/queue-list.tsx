import * as React from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/class-names";
import { formatRelativeTime } from "@/lib/format";
import type { ReviewItem } from "@/server/repositories/ops-repository";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { SEVERITY } from "./status-language";

/**
 * A review queue. DPR UC-12 is explicit that conflicting or low-confidence
 * data creates a task rather than being resolved silently, so an empty queue
 * is a real state worth stating.
 */
export function QueueList({
  title,
  icon: Icon,
  items,
  href,
  limit = 4,
}: {
  title: string;
  icon: LucideIcon;
  items: ReviewItem[];
  href: string;
  limit?: number;
}) {
  // The count is the tile's whole point, so it carries the pressure signal:
  // quiet when the queue is empty, tinted by the worst severity waiting in it.
  const countTone =
    items.length === 0
      ? "text-ink-subtle"
      : items.some((item) => item.severity === "critical")
        ? "text-critical"
        : items.some((item) => item.severity === "warning")
          ? "text-caution"
          : "text-ink";

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="py-2.5">
        <span className="flex items-center gap-2">
          <Icon className="size-4 text-ink-subtle" aria-hidden />
          <CardTitle className="text-[14px]">{title}</CardTitle>
        </span>
        <span className={cn("font-num text-md font-semibold", countTone)}>{items.length}</span>
      </CardHeader>

      {items.length === 0 ? (
        <p className="flex-1 px-4 py-5 text-center text-sm text-ink-muted">
          Nothing waiting.
        </p>
      ) : (
        <ul className="flex-1 divide-y divide-line">
          {items.slice(0, limit).map((item) => (
            <li key={`${item.influencerId}-${item.reason}`}>
              <Link prefetch={false}
                href={`/influencers/${item.influencerId}`}
                className="flex items-start gap-2 px-4 py-2 transition-colors hover:bg-sunken/70"
              >
                <span
                  className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", SEVERITY[item.severity])}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-medium text-ink">
                    {item.displayName}
                  </span>
                  <span className="block truncate text-sm text-ink-muted">
                    {item.reason} · {formatRelativeTime(item.observedAt)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-line px-4 py-2">
        <Link href={href} className="rounded text-sm font-medium text-brand-ink hover:underline">
          {items.length > limit ? `View all ${items.length}` : "Open queue"}
        </Link>
      </div>
    </Card>
  );
}
