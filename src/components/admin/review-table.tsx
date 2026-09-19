import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/class-names";
import { formatRelativeTime } from "@/lib/format";
import type { ReviewItem } from "@/server/repositories/ops-repository";
import { Avatar } from "@/components/ui/avatar";
import { Panel, PanelBody, PanelHead, PanelTitle, RowList } from "@/components/ui/panel";
import { SEVERITY } from "./status-language";

/* ---------------------------------------------------------------------------
 * The review queue.
 *
 * Every human-review surface in the admin workspace renders through this, so
 * it is worth stating what it is not: it is not a table of rows to administer.
 * A queue item is a finding — something was measured, it fell outside a stated
 * threshold, and a person has to decide what to do about it. The layout says
 * that: the finding leads, the evidence sits under it, and the decision is one
 * control on the right.
 *
 * A table put the sentence that matters into a `max-w-lg` cell in column three
 * and gave column one to a name nobody was scanning for.
 * ------------------------------------------------------------------------ */

const SEVERITY_LABEL: Record<ReviewItem["severity"], string> = {
  info: "For review",
  warning: "Needs attention",
  critical: "Blocking",
};

const SEVERITY_ORDER: ReviewItem["severity"][] = ["critical", "warning", "info"];

export function ReviewTable({
  items,
  emptyTitle,
  emptyDescription,
  actionLabel,
  title,
  /** What the detectors behind this queue actually check. Shown when empty. */
  watchList,
}: {
  items: ReviewItem[];
  emptyTitle: string;
  emptyDescription: string;
  actionLabel?: string;
  title?: string;
  watchList?: string[];
}) {
  if (items.length === 0) {
    return (
      <Panel>
        <PanelBody className="py-10">
          <div className="mx-auto max-w-md text-center">
            <p className="text-md font-semibold text-ink">{emptyTitle}</p>
            <p className="mt-1 text-base text-ink-muted">{emptyDescription}</p>
            {watchList && watchList.length > 0 && (
              <>
                <p className="mt-5 label-caps-sm text-ink-subtle">
                  What this queue watches
                </p>
                <ul className="mx-auto mt-2 grid max-w-sm gap-x-6 gap-y-1 text-left text-sm text-ink-muted sm:grid-cols-2">
                  {watchList.map((signal) => (
                    <li key={signal} className="flex items-center gap-2">
                      <span aria-hidden className="size-1 rounded-full bg-ink-subtle" />
                      {signal}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </PanelBody>
      </Panel>
    );
  }

  // Counted by severity so the header states the shape of the backlog rather
  // than only its size — five blocking items and five informational ones are
  // not the same afternoon.
  const counts = SEVERITY_ORDER.map((severity) => ({
    severity,
    count: items.filter((item) => item.severity === severity).length,
  })).filter((entry) => entry.count > 0);

  const ordered = [...items].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  );

  return (
    <Panel>
      <PanelHead>
        <PanelTitle>{title ?? "Signals awaiting a decision"}</PanelTitle>
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          {counts.map((entry) => (
            <li key={entry.severity} className="inline-flex items-center gap-1.5">
              <span
                className={cn("size-1.5 rounded-full", SEVERITY[entry.severity])}
                aria-hidden
              />
              <span className="font-num text-ink">{entry.count}</span>
              <span className="text-ink-muted">{SEVERITY_LABEL[entry.severity]}</span>
            </li>
          ))}
        </ul>
      </PanelHead>

      <RowList>
        {ordered.map((item) => (
          <li key={`${item.influencerId}-${item.reason}`}>
            <Link prefetch={false}
              href={`/influencers/${item.influencerId}`}
              aria-label={`${actionLabel ?? "Open"} — ${item.displayName}: ${item.reason}`}
              className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-sunken/70"
            >
              <span
                className={cn(
                  "mt-1.5 size-1.5 shrink-0 rounded-full",
                  SEVERITY[item.severity],
                )}
                aria-hidden
              />
              <Avatar name={item.displayName} size="sm" className="mt-px shrink-0" />

              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-base font-semibold text-ink">
                    {item.reason}
                  </span>
                  <span className="text-sm text-ink-muted">
                    {item.displayName}
                    <span aria-hidden> · </span>
                    <span className="font-num">@{item.handle}</span>
                  </span>
                </span>
                <span className="mt-0.5 block max-w-3xl text-sm text-ink-muted">
                  {item.detail}
                </span>
              </span>

              <span className="hidden shrink-0 self-center whitespace-nowrap text-sm text-ink-subtle md:block">
                {formatRelativeTime(item.observedAt)}
              </span>
              <span className="flex shrink-0 items-center gap-1 self-center text-sm font-medium text-brand-ink">
                <span className="hidden lg:inline">{actionLabel ?? "Open"}</span>
                <ArrowRight
                  className="size-3.5 transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </span>
            </Link>
          </li>
        ))}
      </RowList>
    </Panel>
  );
}
