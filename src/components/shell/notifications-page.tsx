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
  at: string;
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

export function NotificationsList({ items }: { items: NotificationItem[] }) {
  if (items.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={Bell}
          title="Nothing to report"
          description="SocialOrbit watches the creators you track for dormancy, growth anomalies, engagement decline, stale data, brand-safety signals and expiring connections. You will hear from us when one of those fires."
        />
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alerts</CardTitle>
        <Badge tone="neutral">{items.length}</Badge>
      </CardHeader>
      <ul className="divide-y divide-line">
        {items.map((item) => {
          const Icon = ICONS[item.kind];
          const content = (
            <span className="flex items-start gap-3 px-4 py-3">
              <Icon className={cn("mt-0.5 size-4 shrink-0", SEVERITY[item.severity])} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium text-ink">{item.title}</span>
                <span className="block text-[13px] leading-5 text-ink-muted">{item.detail}</span>
              </span>
              <span className="shrink-0 whitespace-nowrap text-[12px] text-ink-muted">
                {formatRelativeTime(item.at)}
              </span>
            </span>
          );

          return (
            <li key={item.id}>
              {item.href ? (
                <Link href={item.href} className="block transition-colors hover:bg-brand-softer">
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
