import * as React from "react";
import Link from "next/link";
import {
  Activity,
  BadgeCheck,
  Bell,
  KeyRound,
  Link2,
  TrendingDown,
  TriangleAlert,
} from "lucide-react";
import { cn } from "@/lib/class-names";
import { formatRelativeTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";

/* ---------------------------------------------------------------------------
 * Alerts — DPR §21.
 *
 * The alert *types* are the product surface; the list is populated from real
 * detections. Nothing is invented to make the page look busy — an empty inbox
 * says so.
 * ------------------------------------------------------------------------ */

export interface NotificationItem {
  id: string;
  kind:
    | "dormancy"
    | "growth_spike"
    | "view_anomaly"
    | "engagement_decline"
    | "data_stale"
    | "oauth_reauth"
    | "ai_conflict"
    | "brand_safety"
    | "quota_warning"
    | "verification";
  title: string;
  detail: string;
  /**
   * A real event anchor — lastRefreshedAt, lastActiveAt. Optional on purpose:
   * when no anchor exists the row shows no time rather than a render-minted
   * "just now", which would be a manufactured observation.
   */
  at?: string;
  href?: string;
  severity: "info" | "warning" | "critical";
}

const ICONS: Record<NotificationItem["kind"], typeof Bell> = {
  dormancy: Activity,
  growth_spike: Activity,
  view_anomaly: Activity,
  engagement_decline: TrendingDown,
  data_stale: TriangleAlert,
  oauth_reauth: Link2,
  ai_conflict: TriangleAlert,
  brand_safety: TriangleAlert,
  quota_warning: KeyRound,
  verification: BadgeCheck,
};

const SEVERITY: Record<NotificationItem["severity"], string> = {
  info: "text-ink-subtle",
  warning: "text-caution",
  critical: "text-critical",
};

/* Triage hierarchy is structural, not just an icon tint: warning and critical
   rows carry a 2px severity rule and a caps kind tag, and critical sorts to
   the top — a brand-safety escalation must not queue behind info notes. */
const SEVERITY_RULE: Record<NotificationItem["severity"], string | undefined> = {
  info: undefined,
  warning: "border-l-2 border-l-caution",
  critical: "border-l-2 border-l-critical",
};

const SEVERITY_RANK: Record<NotificationItem["severity"], number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

export function NotificationsList({
  items,
  emptyDescription = "SENSO watches the creators you track for dormancy, growth anomalies, engagement decline, stale data, brand-safety signals and expiring connections. You will hear from us when one of those fires.",
}: {
  items: NotificationItem[];
  /** The creator route re-voices this; the default speaks to clients. */
  emptyDescription?: React.ReactNode;
}) {
  if (items.length === 0) {
    return (
      <Card>
        <EmptyState icon={Bell} title="Nothing to report" description={emptyDescription} />
      </Card>
    );
  }

  const ordered = [...items].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alerts</CardTitle>
        <Badge tone="neutral">{items.length}</Badge>
      </CardHeader>
      <ul className="divide-y divide-line">
        {ordered.map((item) => {
          const Icon = ICONS[item.kind];
          const content = (
            <span className="flex items-start gap-3 px-4 py-3">
              <Icon className={cn("mt-0.5 size-4 shrink-0", SEVERITY[item.severity])} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-ink">{item.title}</span>
                <span className="block text-base text-ink-muted">{item.detail}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {item.severity !== "info" && (
                  <span className={cn("label-caps-sm", SEVERITY[item.severity])}>
                    {item.kind.replace(/_/g, " ")}
                  </span>
                )}
                {item.at && (
                  <span className="whitespace-nowrap text-sm text-ink-muted">
                    {formatRelativeTime(item.at)}
                  </span>
                )}
              </span>
            </span>
          );

          return (
            <li key={item.id} className={SEVERITY_RULE[item.severity]}>
              {item.href ? (
                <Link href={item.href} className="block transition-colors hover:bg-sunken/70">
                  {content}
                </Link>
              ) : (
                content
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
