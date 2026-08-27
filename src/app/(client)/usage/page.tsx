import type { Metadata } from "next";
import { Check, Minus } from "lucide-react";
import { PLAN_CONFIG, Plan } from "@/lib/contracts/auth";
import { formatNumber, formatRelativeTime } from "@/lib/format";
import { requirePagePermission } from "@/server/auth/rbac";
import { quotaFor } from "@/server/repositories/usage-repository";
import { usageSnapshot } from "@/server/services/search-service";
import { PageBody, PageHeader } from "@/components/shell/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatRow, StatTile } from "@/components/intelligence/stat";

export const metadata: Metadata = { title: "Usage & billing" };
export const dynamic = "force-dynamic";

const FEATURES: { label: string; read: (plan: Plan) => string | boolean }[] = [
  {
    label: "Influencer searches per month",
    read: (plan) => PLAN_CONFIG[plan].searchesPerMonth?.toLocaleString() ?? "Unlimited",
  },
  { label: "Seats", read: (plan) => PLAN_CONFIG[plan].seats?.toLocaleString() ?? "Unlimited" },
  { label: "Compare creators", read: (plan) => PLAN_CONFIG[plan].features.compare },
  { label: "Shortlists", read: () => true },
  { label: "Campaign management", read: (plan) => PLAN_CONFIG[plan].features.campaigns },
  { label: "Exports", read: (plan) => PLAN_CONFIG[plan].features.exports },
  { label: "Developer API", read: (plan) => PLAN_CONFIG[plan].features.api },
  {
    label: "API requests per month",
    read: (plan) =>
      PLAN_CONFIG[plan].features.api
        ? (PLAN_CONFIG[plan].apiRequestsPerMonth?.toLocaleString() ?? "Unlimited")
        : false,
  },
];

export default async function UsagePage() {
  const user = await requirePagePermission("billing:read", "/usage");
  const quota = quotaFor(user.orgId, user.plan);
  const usage = usageSnapshot(user.orgId);
  const plan = PLAN_CONFIG[user.plan];

  const pct =
    quota.limit === null ? 0 : Math.min(100, Math.round((quota.used / quota.limit) * 100));

  return (
    <>
      <PageHeader
        title="Usage & billing"
        description={`${user.orgName} is on the ${plan.label} plan. Usage is metered server-side and resets each calendar month.`}
      />
      <PageBody className="space-y-4">
        <StatRow>
          <StatTile
            label="Searches used"
            value={
              quota.limit === null
                ? formatNumber(quota.used)
                : `${quota.used} / ${quota.limit}`
            }
            footnote={`resets ${formatRelativeTime(quota.resetsAt)}`}
            emphasis={quota.limit !== null && (quota.remaining ?? 0) <= 1}
          />
          <StatTile label="API requests" value={formatNumber(usage.apiRequests)} />
          <StatTile label="Exports" value={formatNumber(usage.exports)} />
          <StatTile label="Reports generated" value={formatNumber(usage.reports)} />
        </StatRow>

        {quota.limit !== null && (
          <Card>
            <CardHeader>
              <CardTitle>Search allowance</CardTitle>
              <span className="font-num text-[13px] tabular-nums text-ink">
                {quota.remaining} left
              </span>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="h-2 overflow-hidden rounded-full bg-line">
                <div
                  className={`h-full rounded-full ${pct >= 100 ? "bg-critical" : pct >= 80 ? "bg-caution" : "bg-brand"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-[13px] text-ink-muted">
                A search is counted when you apply a keyword or a filter. Paging through
                results you already opened, re-sorting them, and opening saved profiles or
                shortlists are all free.
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Plans</CardTitle>
          </CardHeader>
          <div className="scroll-x">
            <table className="w-full min-w-max border-collapse text-[13px]">
              <thead className="border-b border-line bg-sunken/60">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-[0.05em] text-ink-muted">
                    Feature
                  </th>
                  {Plan.options.map((option) => (
                    <th key={option} scope="col" className="px-3 py-2 text-left">
                      <span className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-ink">
                          {PLAN_CONFIG[option].label}
                        </span>
                        {option === user.plan && <Badge tone="brand">Current</Badge>}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {FEATURES.map((feature) => (
                  <tr key={feature.label}>
                    <th scope="row" className="px-3 py-2 text-left font-normal text-ink-muted">
                      {feature.label}
                    </th>
                    {Plan.options.map((option) => {
                      const value = feature.read(option);
                      return (
                        <td key={option} className="px-3 py-2">
                          {typeof value === "boolean" ? (
                            value ? (
                              <Check className="size-4 text-positive" aria-label="Included" />
                            ) : (
                              <Minus className="size-4 text-ink-subtle" aria-label="Not included" />
                            )
                          ) : (
                            <span className="font-num tabular-nums text-ink">{value}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <CardContent className="border-t border-line">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[13px] text-ink-muted">
                Plan changes are handled by your account manager while self-serve billing is
                being built.
              </p>
              <Button variant="primary">Talk to us about upgrading</Button>
            </div>
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
