import type { Metadata } from "next";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/class-names";
import { PLAN_CONFIG, Plan } from "@/lib/contracts/auth";
import { formatDate, formatNumber, formatRelativeTime } from "@/lib/format";
import { can, requirePagePermission } from "@/server/auth/rbac";
import { quotaFor } from "@/server/repositories/usage-repository";
import { entitlements, pendingChange, statements } from "@/server/services/billing-service";
import { PlanManager } from "@/components/agency/plan-manager";
import { usageSnapshot } from "@/server/services/search-service";
import { PageBody, PageHeader } from "@/components/shell/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QuotaMeter } from "@/components/intelligence/quota-meter";
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
  const limits = await entitlements(user.orgId, user.plan);
  const pending = pendingChange(user.orgId);
  const periods = await statements(user.orgId, user.plan);
  const canWrite = can(user, "billing:write");

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="Usage & billing"
        description={`${user.orgName} is on the ${plan.label} plan. Usage is metered server-side and resets each calendar month.`}
        meta={
          <span className="font-num text-sm text-ink-muted">
            {formatDate(quota.periodStart)} – {formatDate(quota.resetsAt)}
          </span>
        }
      />
      <PageBody className="space-y-4">
        {/* The lead card: the same film-frame gauge the dashboard and the
            discovery toolbar mount, so quota reads in one grammar everywhere. */}
        {quota.limit !== null && (
          <Card>
            <CardHeader>
              <CardTitle>Search allowance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <QuotaMeter
                variant="labelled"
                label="Full searches"
                spent={quota.used}
                limit={quota.limit}
              />
              <p className="text-base text-ink-muted">
                A search is counted when you apply a keyword or a filter. Paging through
                results you already opened, re-sorting them, and opening saved profiles or
                shortlists are all free.
              </p>
            </CardContent>
          </Card>
        )}

        <StatRow>
          {quota.limit === null && (
            <StatTile
              label="Searches used"
              value={formatNumber(quota.used)}
              footnote={`resets ${formatRelativeTime(quota.resetsAt)}`}
            />
          )}
          <StatTile label="API requests" value={formatNumber(usage.apiRequests)} />
          <StatTile label="Exports" value={formatNumber(usage.exports)} />
          <StatTile label="Reports generated" value={formatNumber(usage.reports)} />
        </StatRow>

        <Card>
          <CardHeader>
            <CardTitle>Plans</CardTitle>
          </CardHeader>
          <div className="scroll-x">
            {/* Value columns are centered at equal fixed widths; the current
                plan's whole column is tinted so position reads at a glance and
                the badge becomes reinforcement, not the only marker. */}
            <table className="w-full min-w-max border-collapse text-base">
              <thead className="border-b border-line bg-sunken/60">
                <tr>
                  <th scope="col" className="label-caps px-3 py-2 text-left text-ink-muted">
                    Feature
                  </th>
                  {Plan.options.map((option) => (
                    <th
                      key={option}
                      scope="col"
                      className={cn(
                        "w-32 px-3 py-2 text-center",
                        option === user.plan && "bg-brand-softer",
                      )}
                    >
                      <span className="flex items-center justify-center gap-2">
                        <span className="text-base font-semibold text-ink">
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
                        <td
                          key={option}
                          className={cn(
                            "w-32 px-3 py-2 text-center",
                            option === user.plan && "bg-brand-softer",
                          )}
                        >
                          {typeof value === "boolean" ? (
                            value ? (
                              <Check className="mx-auto size-4 text-positive" aria-label="Included" />
                            ) : (
                              <Minus className="mx-auto size-4 text-ink-subtle" aria-label="Not included" />
                            )
                          ) : (
                            <span className="font-num text-ink">{value}</span>
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
            <PlanManager plan={user.plan} pending={pending} canWrite={canWrite} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What your plan includes, and what you have used</CardTitle>
          </CardHeader>
          <ul className="divide-y divide-rule">
            {limits.map((item) => (
              <li key={item.key} className="flex items-center gap-3 px-4 py-2.5">
                <span className="min-w-0 flex-1 text-ink">{item.label}</span>
                <span className="font-num text-ink">
                  {formatNumber(item.used)}
                  <span className="text-ink-subtle">
                    {" / "}
                    {item.limit === null ? "unlimited" : formatNumber(item.limit)}
                  </span>
                </span>
                {item.exceeded && <Badge tone="critical">Over</Badge>}
              </li>
            ))}
          </ul>
        </Card>

        {periods.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Usage by period</CardTitle>
            </CardHeader>
            <ul className="divide-y divide-rule">
              {periods.map((period) => (
                <li key={period.periodStart} className="px-4 py-3">
                  <p className="flex items-center gap-2 font-medium text-ink">
                    {formatDate(period.periodStart)}
                    {period.current && <Badge tone="neutral">Open</Badge>}
                  </p>
                  <p className="mt-0.5 font-num text-sm text-ink-muted">
                    {period.lines
                      .map((line) => `${line.label}: ${formatNumber(line.count)}`)
                      .join(" · ")}
                  </p>
                </li>
              ))}
            </ul>
            <CardContent className="border-t border-line">
              <p className="text-sm text-ink-subtle">
                What was used, not what is owed — SENSO holds no price list, so this is a
                usage statement rather than an invoice.
              </p>
            </CardContent>
          </Card>
        )}
      </PageBody>
    </>
  );
}
