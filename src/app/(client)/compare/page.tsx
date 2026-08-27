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
import { RiskBadge, ScorePill } from "@/components/intelligence/score";

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
          title="Compare creators"
          description="Put creators side by side on normalised metrics before committing a budget."
        />
        <PageBody>
          <Card>
            <EmptyState
              icon={Scale}
              title={profiles.length === 0 ? "Nothing selected" : "Select at least two creators"}
              description="Pick creators in discovery or from a shortlist, then choose Compare."
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
            <span className="text-[12px] text-ink-muted">
              Oldest observation in this set: {formatRelativeTime(oldestRefresh)}
            </span>
          ) : null
        }
      />

      <PageBody className="space-y-4">
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
                            className="block truncate rounded text-[13px] font-medium normal-case tracking-normal text-ink hover:text-brand-ink hover:underline"
                          >
                            {profile.displayName}
                          </Link>
                          <span className="block truncate font-num text-[11px] font-normal normal-case tracking-normal text-ink-muted">
                            {PLATFORM_LABEL[profile.primaryPlatform]}
                          </span>
                        </div>
                      </div>
                    </Th>
                  ))}
                </Tr>
              </Thead>
              <Tbody>
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
                    <span className="text-[12px] text-ink-muted">
                      {formatRelativeTime(profile.lastRefreshedAt)}
                    </span>
                  )}
                </Row>
              </Tbody>
            </Table>
          </TableWrap>
        </Card>

        {mixedPlatforms && (
          <p className="text-[12px] text-ink-muted">
            * Measured against a different denominator per platform — see the note above.
          </p>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-[14px]">How to read this</CardTitle>
          </CardHeader>
          <ul className="space-y-1.5 px-4 pb-4 text-[13px] leading-5 text-ink-muted">
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
      <Td
        colSpan={span}
        className="bg-sunken/60 py-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-ink-muted"
      >
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
              <ScorePill value={current} label={label} />
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
