import type { Metadata } from "next";
import { Check, Minus } from "lucide-react";
import { PLAN_CONFIG, Plan } from "@/lib/contracts/auth";
import { MarketingChrome } from "@/components/shell/marketing-chrome";
import { LinkButton } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Pricing",
  description: "SocialOrbit plans — search allowances, seats, campaigns and API access.",
};

const ROWS: { label: string; read: (plan: Plan) => string | boolean }[] = [
  {
    label: "Influencer searches per month",
    read: (plan) => PLAN_CONFIG[plan].searchesPerMonth?.toLocaleString() ?? "Unlimited",
  },
  { label: "Seats", read: (plan) => PLAN_CONFIG[plan].seats?.toLocaleString() ?? "Unlimited" },
  { label: "Full creator profiles", read: () => true },
  { label: "Shortlists", read: () => true },
  { label: "Comparison", read: (plan) => PLAN_CONFIG[plan].features.compare },
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

const POSITIONING: Record<Plan, string> = {
  free: "Evaluate the database and the scoring before committing anything.",
  growth: "For teams running campaigns continuously across a roster of creators.",
  enterprise: "For agencies and platforms querying the database programmatically.",
};

export default function PricingPage() {
  return (
    <MarketingChrome>
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="max-w-2xl space-y-3">
          <Eyebrow>Pricing</Eyebrow>
          <h1 className="text-[32px] font-bold leading-[1.1] tracking-[-0.03em] text-ink sm:text-[40px]">
            Every plan sees the same numbers.
          </h1>
          <p className="text-[15px] leading-6 text-ink-muted">
            Plans differ in how much you can search and what you can automate — never in the
            quality of the data or in what SocialOrbit is willing to tell you about it.
            Provenance, confidence and score components are on every profile at every tier.
          </p>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {Plan.options.map((plan) => (
            <div
              key={plan}
              className={`lift flex flex-col rounded-xl border bg-surface p-5 ${
                plan === "growth" ? "border-ink shadow-overlay" : "border-line shadow-raised"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-[17px] font-bold tracking-[-0.02em] text-ink">
                  {PLAN_CONFIG[plan].label}
                </h2>
                {plan === "growth" && (
                  <span className="label-caps rounded-sm bg-ink px-1.5 py-0.5 text-ink-inverse">
                    Most teams
                  </span>
                )}
              </div>
              <p className="mt-2 min-h-10 text-[13px] leading-5 text-ink-muted">
                {POSITIONING[plan]}
              </p>
              <p className="mt-4 font-num text-[15px] font-semibold text-ink">
                {PLAN_CONFIG[plan].searchesPerMonth === null
                  ? "Unlimited searches"
                  : `${PLAN_CONFIG[plan].searchesPerMonth} searches / month`}
              </p>
              <LinkButton
                href="/register"
                variant={plan === "growth" ? "primary" : "secondary"}
                className="mt-4 w-full"
              >
                {plan === "free" ? "Start free" : "Request access"}
              </LinkButton>
            </div>
          ))}
        </div>

        <div className="scroll-x mt-10 rounded-xl border border-line bg-surface">
          <table className="w-full min-w-max border-collapse text-[13px]">
            <caption className="sr-only">Feature comparison across plans</caption>
            <thead className="border-b border-line bg-sunken/60">
              <tr>
                <th scope="col" className="label-caps px-3 py-2 text-left text-ink-muted">
                  Feature
                </th>
                {Plan.options.map((plan) => (
                  <th key={plan} scope="col" className="px-3 py-2 text-left font-semibold text-ink">
                    {PLAN_CONFIG[plan].label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {ROWS.map((row) => (
                <tr key={row.label}>
                  <th scope="row" className="px-3 py-2 text-left font-normal text-ink-muted">
                    {row.label}
                  </th>
                  {Plan.options.map((plan) => {
                    const value = row.read(plan);
                    return (
                      <td key={plan} className="px-3 py-2">
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

        <p className="mt-6 text-[13px] text-ink-muted">
          A search is counted when you apply a keyword or a filter. Paging, re-sorting, opening
          a saved profile and viewing a shortlist are all free on every plan.
        </p>
      </section>
    </MarketingChrome>
  );
}
