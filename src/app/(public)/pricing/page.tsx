import type { Metadata } from "next";
import { Check, Code2, Minus } from "lucide-react";
import { PLAN_CONFIG, Plan } from "@/lib/contracts/auth";
import { MarketingChrome } from "@/components/shell/marketing-chrome";
import { LinkButton } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "SocialOrbit plans — search allowances, seats, campaigns and versioned API access.",
};

/*
 * The developer API lives here rather than on the homepage.
 *
 * An API terminal on a page written for a marketing director is an audience
 * mismatch: it takes the largest visual on the fold and speaks to nobody the
 * page is trying to convince. Beside the plan that actually grants the access,
 * it is answering a question the reader has just asked.
 */
const API_QUERY = `GET /v1/influencers
    ?country=IN
    &language=en
    &category=technology
    &followers_min=100000
    &followers_max=1000000
    &health_min=75
    &engagement_min=3
    &verified=true
    &sort=health_score_desc

Authorization: Bearer so_live_••••••••`;

const API_POINTS = [
  {
    title: "The same service layer the product calls",
    body: "Not an export. Every endpoint runs the code the application itself runs, so a figure from the API and a figure on screen cannot disagree.",
  },
  {
    title: "Versioned and field-level",
    body: "A versioned REST contract over the canonical influencer record, with per-client rate limits, field-level access control and usage tracking.",
  },
  {
    title: "Provenance travels with the data",
    body: "Every value carries its source tier, its collection time and its confidence, so a number that leaves the platform keeps the context that makes it defensible.",
  },
];

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
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
        <div className="max-w-2xl space-y-3">
          <h1 className="display-lg text-ink">Every plan sees the same numbers.</h1>
          <p className="text-md leading-6 text-ink-muted">
            Plans differ in how much you can search and what you can automate — never in the
            quality of the data or in what SocialOrbit is willing to tell you about it.
            Provenance, confidence and score components are on every profile at every tier.
          </p>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {Plan.options.map((plan) => (
            <div
              key={plan}
              className={`flex flex-col rounded-xl border bg-surface p-5 shadow-raised ${
                plan === "growth" ? "border-ink" : "border-line"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <Eyebrow as="h2">{PLAN_CONFIG[plan].label}</Eyebrow>
                {plan === "growth" && (
                  <span className="label-caps rounded-sm bg-ink px-1.5 py-0.5 text-ink-inverse">
                    Most teams
                  </span>
                )}
              </div>
              {/* The allowance is the plan's one quantitative differentiator,
                  so it leads — set in the product's light-numeral treatment. */}
              <p className="mt-4">
                {PLAN_CONFIG[plan].searchesPerMonth === null ? (
                  <span className="text-display font-medium leading-none tracking-display text-ink">
                    Unlimited
                  </span>
                ) : (
                  <span className="font-num text-display font-medium leading-none text-ink">
                    {PLAN_CONFIG[plan].searchesPerMonth}
                  </span>
                )}
                <span className="mt-2 block label-caps text-ink-subtle">searches / month</span>
              </p>
              <p className="mt-4 flex-1 text-base leading-5 text-ink-muted">
                {POSITIONING[plan]}
              </p>
              <LinkButton
                href="/register"
                variant={plan === "growth" ? "primary" : "secondary"}
                className="mt-5 w-full"
              >
                {plan === "free" ? "Start free" : "Request access"}
              </LinkButton>
            </div>
          ))}
        </div>

        <div className="scroll-x mt-10 rounded-xl bg-surface card-shadow">
          <table className="w-full min-w-max border-collapse text-base">
            <caption className="sr-only">Feature comparison across plans</caption>
            <colgroup>
              <col className="w-2/5" />
              {Plan.options.map((plan) => (
                <col key={plan} className="w-1/5" />
              ))}
            </colgroup>
            <thead className="border-b border-line bg-sunken/60">
              <tr>
                <th scope="col" className="label-caps px-3 py-2 text-left text-ink-muted">
                  Feature
                </th>
                {Plan.options.map((plan) => (
                  <th
                    key={plan}
                    scope="col"
                    className="px-3 py-2 text-center font-semibold text-ink"
                  >
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
                      <td key={plan} className="px-3 py-2 text-center">
                        {typeof value === "boolean" ? (
                          <span className="flex justify-center">
                            {value ? (
                              <Check className="size-4 text-positive" aria-label="Included" />
                            ) : (
                              <Minus
                                className="size-4 text-ink-subtle"
                                aria-label="Not included"
                              />
                            )}
                          </span>
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

        <p className="mt-6 text-base text-ink-muted">
          A search is counted when you apply a keyword or a filter. Paging, re-sorting, opening
          a saved profile and viewing a shortlist are all free on every plan.
        </p>
      </section>

      <section id="api" className="border-t border-line bg-sunken">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="grid items-start gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div>
              <h2 className="mt-3 text-title font-semibold tracking-display text-ink">
                The same database the product runs on.
              </h2>
              <dl className="mt-8 divide-y divide-rule border-t border-rule">
                {API_POINTS.map((point) => (
                  <div key={point.title} className="py-4">
                    <dt className="text-base font-semibold text-ink">{point.title}</dt>
                    <dd className="mt-1 text-base leading-6 text-ink-muted">
                      {point.body}
                    </dd>
                  </div>
                ))}
              </dl>
              <LinkButton href="/register" className="mt-6 gap-2">
                <Code2 className="size-4" aria-hidden />
                Get API access
              </LinkButton>
            </div>

            <div className="min-w-0 overflow-hidden rounded-2xl bg-instrument shadow-instrument">
              <div className="border-b border-instrument-line px-4 py-2.5">
                <span className="label-caps text-instrument-muted">
                  GET /v1/influencers
                </span>
              </div>
              <pre className="scroll-x px-4 py-4 text-sm leading-6 text-instrument-ink">
                <code>{API_QUERY}</code>
              </pre>
            </div>
          </div>
        </div>
      </section>
    </MarketingChrome>
  );
}
