import type { Metadata } from "next";
import Link from "next/link";
import { Scale, TriangleAlert } from "lucide-react";
import { CATEGORY_LABEL, PLATFORM_LABEL } from "@/lib/contracts/common";
import { HEALTH_COMPONENT_LABEL, type HealthComponentKey } from "@/lib/contracts/score";
import type { InfluencerProfile } from "@/lib/contracts/influencer";
import {
  formatCompact,
  formatDuration,
  formatFrequency,
  formatPercent,
  formatRelativeTime,
  NO_VALUE,
} from "@/lib/format";
import { requirePagePermission } from "@/server/auth/rbac";
import { toProfile } from "@/server/repositories/influencer-repository";
import { PageBody, PageHeader } from "@/components/shell/app-shell";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, Notice } from "@/components/ui/states";
import { Table, TableWrap, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table";
import { ConfidenceMeter } from "@/components/intelligence/provenance";
import { RiskBadge, ScorePill, ScoreRing } from "@/components/intelligence/score";

export const metadata: Metadata = { title: "Compare" };
export const dynamic = "force-dynamic";

const MAX_COMPARE = 5;

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  await requirePagePermission("influencer:compare", "/compare");
  const { ids } = await searchParams;

  const requested = (ids ?? "").split(",").map((id) => id.trim()).filter(Boolean);
  const profiles = requested
    .slice(0, MAX_COMPARE)
    .map((id) => toProfile(id))
    .filter((profile): profile is InfluencerProfile => profile !== null);

  if (profiles.length < 2) {
    return (
      <>
        <PageHeader
          eyebrow="Discover"
          title="Compare creators"
          description="Put creators side by side on normalised metrics before committing a budget."
        />
        <PageBody>
          <Card>
            <div className="flex flex-col items-center justify-center gap-8 px-6 py-14 sm:flex-row">
              {/* A ghost of the instrument this page builds: two dashed
                  columns with unmeasured score bars, so the empty state
                  previews the comparison it invites rather than describing
                  one in the abstract. */}
              <div aria-hidden className="flex shrink-0 gap-4">
                {[0, 1].map((column) => (
                  <div
                    key={column}
                    className="flex w-28 flex-col items-center gap-3 rounded-lg border border-dashed border-line px-4 py-4"
                  >
                    <div className="size-12 rounded-full border-2 border-dashed border-line" />
                    <div className="w-full space-y-2">
                      <div className="h-1 rounded-sm border border-dashed border-line bg-transparent" />
                      <div className="h-1 rounded-sm border border-dashed border-line bg-transparent" />
                      <div className="h-1 rounded-sm border border-dashed border-line bg-transparent" />
                    </div>
                  </div>
                ))}
              </div>
              <EmptyState
                icon={Scale}
                title={profiles.length === 0 ? "Nothing selected" : "Select at least two creators"}
                description="Pick creators in discovery or from a shortlist, then choose Compare."
                className="p-0 sm:items-start sm:text-left"
                action={
                  <div className="flex gap-2">
                    <LinkButton href="/discovery" variant="primary" size="sm">
                      Go to discovery
                    </LinkButton>
                    <LinkButton href="/shortlists" size="sm">
                      Open shortlists
                    </LinkButton>
                  </div>
                }
              />
            </div>
          </Card>
        </PageBody>
      </>
    );
  }

  /* Engagement rate uses the denominator each platform actually reports —
     views on YouTube, followers on Instagram. Comparing the two as if they
     were one number is exactly the kind of quiet error this product exists to
     avoid, so a mixed set says so before the table is read. */
  const platforms = new Set(profiles.map((profile) => profile.primaryPlatform));
  const mixedPlatforms = platforms.size > 1;

  const oldestRefresh = profiles
    .map((profile) => profile.lastRefreshedAt)
    .filter((value): value is string => value !== null)
    .sort()[0];

  const componentKeys = profiles[0].health.components.map(
    (component) => component.key as HealthComponentKey,
  );

  return (
    <>
      <PageHeader
        title="Compare creators"
        description={`${profiles.length} creators, normalised where the platforms allow it.`}
        breadcrumbs={[{ label: "Discovery", href: "/discovery" }, { label: "Compare" }]}
        meta={
          oldestRefresh ? (
            <span className="text-sm text-ink-muted">
              Oldest observation in this set: {formatRelativeTime(oldestRefresh)}
            </span>
          ) : null
        }
      />

      <PageBody className="space-y-4">
        {/* The comparison opens on the instrument, not the spec sheet: each
            creator's headline measurement side by side on the one dark
            surface, confidence on the shared rule beneath. The table that
            follows is the evidence trail. */}
        <section
          className="animate-rise relative overflow-hidden rounded-2xl bg-instrument text-instrument-ink shadow-instrument before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-white/8"
          aria-label="Health scores side by side"
        >
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-instrument-line px-4 py-2.5">
            <h2 className="label-caps text-instrument-muted">SocialOrbit Health</h2>
            <span className="font-num text-xs text-instrument-muted">
              {profiles[0].health.formulaVersion}
            </span>
          </header>
          <div className="scroll-x" tabIndex={0} role="group" aria-label="Creator health readouts">
            <div style={{ minWidth: `${profiles.length * 10}rem` }}>
              <div
                className="rise-stagger grid gap-x-4 px-4 py-5"
                style={{ gridTemplateColumns: `repeat(${profiles.length}, minmax(0, 1fr))` }}
              >
                {profiles.map((profile) => (
                  <div
                    key={profile.id}
                    className="flex min-w-0 flex-col items-center gap-2 text-center"
                  >
                    <ScoreRing
                      value={profile.healthScore}
                      size={96}
                      tone="instrument"
                      label={`${profile.displayName}: SocialOrbit Health`}
                    />
                    <Link
                      href={`/influencers/${profile.id}`}
                      className="max-w-full truncate rounded text-base font-medium hover:underline"
                    >
                      {profile.displayName}
                    </Link>
                    <RiskBadge level={profile.risk} onInstrument />
                  </div>
                ))}
              </div>
              {/* Confidence on its own shared rule — a separate axis from the
                  score, and it must not read as part of the value. */}
              <div
                className="grid gap-x-4 border-t border-instrument-line px-4 py-3"
                style={{ gridTemplateColumns: `repeat(${profiles.length}, minmax(0, 1fr))` }}
              >
                {profiles.map((profile) => (
                  <div key={profile.id} className="min-w-0 text-center">
                    <span className="label-caps-sm text-instrument-muted">Confidence</span>
                    <p className="font-num text-base font-semibold">
                      {Math.round(profile.confidenceDetail.score)}%
                      <span className="ml-1.5 font-sans text-xs font-normal text-instrument-muted">
                        {profile.confidenceDetail.band}
                      </span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {requested.length > MAX_COMPARE && (
          <Notice tone="caution" title={`Showing the first ${MAX_COMPARE}`}>
            A comparison stops being readable beyond {MAX_COMPARE} columns. Narrow the
            selection to see the rest.
          </Notice>
        )}

        {mixedPlatforms && (
          <Notice
            tone="caution"
            icon={TriangleAlert}
            title="Engagement rates are not directly comparable across these creators"
          >
            YouTube reports views for every item, so engagement is measured against views.
            Instagram reach is only available on connected professional accounts, so
            engagement there is measured against followers. Both are correct for their
            platform; the ratio between them is not meaningful. Health, authenticity and
            campaign fit are normalised against each creator&apos;s own category cohort and{" "}
            <em>are</em> comparable.
          </Notice>
        )}

        <Card>
          <TableWrap label="Creator comparison">
            <Table>
              <Thead>
                <Tr>
                  <Th className="sticky left-0 z-10 bg-sunken">Metric</Th>
                  {profiles.map((profile) => (
                    <Th key={profile.id} className="min-w-44 normal-case">
                      <div className="flex items-center gap-2 py-1">
                        <Avatar
                          name={profile.displayName}
                          src={profile.avatarUrl}
                          size="xs"
                          verification={profile.verification}
                        />
                        <div className="min-w-0">
                          <Link
                            href={`/influencers/${profile.id}`}
                            className="block truncate rounded text-base font-medium normal-case tracking-normal text-ink hover:text-brand-ink hover:underline"
                          >
                            {profile.displayName}
                          </Link>
                          <span className="block truncate text-xs font-normal normal-case tracking-normal text-ink-muted">
                            {PLATFORM_LABEL[profile.primaryPlatform]}
                          </span>
                        </div>
                      </div>
                    </Th>
                  ))}
                </Tr>
              </Thead>
              <Tbody>
                {/* The product's own measurements lead; identity and platform
                    figures follow as the evidence beneath them. */}
                <Section label="SocialOrbit scores" span={profiles.length + 1} />
                <NumericRow
                  label="Health score"
                  profiles={profiles}
                  value={(profile) => profile.healthScore}
                  render={(value) => String(Math.round(value))}
                  emphasis
                />
                <NumericRow
                  label="Campaign fit"
                  profiles={profiles}
                  value={(profile) => profile.campaignFit}
                  render={(value) => String(Math.round(value))}
                />
                {componentKeys.map((key) => (
                  <NumericRow
                    key={key}
                    label={HEALTH_COMPONENT_LABEL[key]}
                    profiles={profiles}
                    value={(profile) => {
                      const component = profile.health.components.find((c) => c.key === key);
                      return component?.available ? component.value : null;
                    }}
                    render={(value) => String(Math.round(value))}
                    subtle
                  />
                ))}

                <Section label="Identity" span={profiles.length + 1} />
                <Row label="Verification" profiles={profiles}>
                  {(profile) => (
                    <Badge
                      tone={
                        profile.verification === "verified"
                          ? "brand"
                          : profile.verification === "pending"
                            ? "caution"
                            : "neutral"
                      }
                    >
                      {profile.verification}
                    </Badge>
                  )}
                </Row>
                <Row label="Country" profiles={profiles}>
                  {(profile) => profile.countryName ?? NO_VALUE}
                </Row>
                <Row label="Categories" profiles={profiles}>
                  {(profile) =>
                    profile.categories.map((category) => CATEGORY_LABEL[category]).join(", ")
                  }
                </Row>
                <Row label="Platforms" profiles={profiles}>
                  {(profile) =>
                    profile.platforms.map((platform) => PLATFORM_LABEL[platform]).join(", ")
                  }
                </Row>

                <Section label="Audience" span={profiles.length + 1} />
                <NumericRow
                  label="Followers"
                  profiles={profiles}
                  value={(profile) => profile.glance.followers}
                  render={formatCompact}
                />
                <NumericRow
                  label="Median views"
                  profiles={profiles}
                  value={(profile) => profile.glance.medianViews}
                  render={formatCompact}
                />
                <NumericRow
                  label="Total views"
                  profiles={profiles}
                  value={(profile) => profile.glance.totalViews}
                  render={formatCompact}
                />
                <NumericRow
                  label={mixedPlatforms ? "Engagement rate *" : "Engagement rate"}
                  profiles={profiles}
                  value={(profile) => profile.glance.engagementRate}
                  render={(value) => formatPercent(value)}
                  comparable={!mixedPlatforms}
                />

                <Section label="Publishing" span={profiles.length + 1} />
                <NumericRow
                  label="Upload frequency"
                  profiles={profiles}
                  value={(profile) => profile.glance.uploadFrequency}
                  render={formatFrequency}
                />
                <NumericRow
                  label="Content indexed"
                  profiles={profiles}
                  value={(profile) => profile.glance.contentCount}
                  render={formatCompact}
                />
                <Row label="Average length" profiles={profiles}>
                  {(profile) => formatDuration(profile.glance.averageContentLength)}
                </Row>
                <Row label="Activity" profiles={profiles}>
                  {(profile) => (
                    <Badge tone={profile.activity === "dormant" ? "critical" : "neutral"}>
                      {profile.activity.replace("_", " ")}
                    </Badge>
                  )}
                </Row>

                <Section label="Risk & confidence" span={profiles.length + 1} />
                <Row label="Risk level" profiles={profiles}>
                  {(profile) => <RiskBadge level={profile.risk} />}
                </Row>
                <NumericRow
                  label="Estimated bot risk"
                  profiles={profiles}
                  value={(profile) => profile.riskSignals.botRisk}
                  render={(value) => String(Math.round(value))}
                  lowerIsBetter
                />
                <NumericRow
                  label="Inactive audience"
                  profiles={profiles}
                  value={(profile) => profile.riskSignals.inactiveAudience}
                  render={(value) => String(Math.round(value))}
                  lowerIsBetter
                />
                <Row label="Data confidence" profiles={profiles}>
                  {(profile) => (
                    <ConfidenceMeter compact confidence={profile.confidenceDetail} />
                  )}
                </Row>
                <Row label="Last refreshed" profiles={profiles}>
                  {(profile) => (
                    <span className="text-sm text-ink-muted">
                      {formatRelativeTime(profile.lastRefreshedAt)}
                    </span>
                  )}
                </Row>
              </Tbody>
            </Table>
          </TableWrap>
        </Card>

        {mixedPlatforms && (
          <p className="text-sm text-ink-muted">
            * Measured against a different denominator per platform — see the note above.
          </p>
        )}

        <Card>
          <CardHeader>
            <CardTitle>How to read this</CardTitle>
          </CardHeader>
          <ul className="space-y-1.5 px-4 pb-4 text-base text-ink-muted">
            <li>
              Best value in each numeric row is marked. Rows where lower is better —
              bot risk, inactive audience — are marked on that basis.
            </li>
            <li>
              Health components are normalised against each creator&apos;s own category and
              follower-band cohort, so a 70 means the same thing in both columns.
            </li>
            <li>
              A dash means the platform has not exposed that measurement, not that the value
              is zero.
            </li>
            <li>
              Confidence is a separate axis from quality. A high score on thin history is
              still thin history.
            </li>
          </ul>
        </Card>
      </PageBody>
    </>
  );
}

/* --- Row helpers -------------------------------------------------------- */

function Section({ label, span }: { label: string; span: number }) {
  return (
    <Tr>
      <Td colSpan={span} className="label-caps bg-sunken/60 py-1.5 text-ink-muted">
        {label}
      </Td>
    </Tr>
  );
}

function Row({
  label,
  profiles,
  children,
}: {
  label: string;
  profiles: InfluencerProfile[];
  children: (profile: InfluencerProfile) => React.ReactNode;
}) {
  return (
    <Tr>
      <Th scope="row" className="sticky left-0 z-10 bg-surface normal-case tracking-normal">
        {label}
      </Th>
      {profiles.map((profile) => (
        <Td key={profile.id}>{children(profile)}</Td>
      ))}
    </Tr>
  );
}

function NumericRow({
  label,
  profiles,
  value,
  render,
  lowerIsBetter = false,
  emphasis = false,
  subtle = false,
  comparable = true,
}: {
  label: string;
  profiles: InfluencerProfile[];
  value: (profile: InfluencerProfile) => number | null;
  render: (value: number) => string;
  lowerIsBetter?: boolean;
  emphasis?: boolean;
  subtle?: boolean;
  /** False when the metric is not like-for-like across the selected platforms. */
  comparable?: boolean;
}) {
  const values = profiles.map(value);
  const measured = values.filter((v): v is number => v !== null);
  const best =
    !comparable || measured.length < 2
      ? null
      : lowerIsBetter
        ? Math.min(...measured)
        : Math.max(...measured);

  return (
    <Tr>
      <Th
        scope="row"
        className={`sticky left-0 z-10 bg-surface normal-case tracking-normal ${
          subtle ? "font-normal text-ink-muted" : ""
        }`}
      >
        {label}
      </Th>
      {profiles.map((profile, index) => {
        const current = values[index];
        const isBest = best !== null && current === best;
        return (
          <Td key={profile.id} numeric>
            {current === null ? (
              <span className="text-ink-subtle">{NO_VALUE}</span>
            ) : emphasis ? (
              // The emphasis row marks its winner too — the legend promises
              // it, and the health score is the row where it matters most.
              <span
                className={
                  isBest ? "inline-block border-b border-positive pb-px" : undefined
                }
              >
                <ScorePill value={current} label={label} />
                {isBest && <span className="sr-only"> (best in this comparison)</span>}
              </span>
            ) : (
              <span className={isBest ? "font-semibold text-positive" : undefined}>
                {render(current)}
                {isBest && <span className="sr-only"> (best in this comparison)</span>}
              </span>
            )}
          </Td>
        );
      })}
    </Tr>
  );
}
