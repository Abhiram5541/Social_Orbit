import * as React from "react";
import Link from "next/link";
import { ExternalLink, Globe, Languages, Tag } from "lucide-react";
import {
  CATEGORY_LABEL,
  PLATFORM_LABEL,
  type VerificationStatus,
} from "@/lib/contracts/common";
import type { InfluencerProfile } from "@/lib/contracts/influencer";
import { formatCompact } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Freshness } from "@/components/intelligence/provenance";
import { ProfileActions } from "./profile-actions";
import { RefreshButton } from "./refresh-button";

const VERIFICATION: Record<VerificationStatus, { label: string; tone: BadgeTone; note: string }> = {
  verified: {
    label: "SocialOrbit Verified",
    tone: "brand",
    note: "Account connected through OAuth and identity-matched.",
  },
  pending: {
    label: "Verification pending",
    tone: "caution",
    note: "Account connected; identity checks have not completed.",
  },
  unverified: {
    label: "Unverified",
    tone: "neutral",
    note: "Built from public platform data. No account connection established.",
  },
};

export function ProfileHeader({
  profile,
  showClientActions = true,
}: {
  profile: InfluencerProfile;
  /**
   * Shortlisting, comparing and campaign hand-off belong to a client
   * workspace. A creator looking at their own profile has no shortlists, and
   * the buttons redirected them back to their portal — a control that bounces
   * whoever presses it is worse than an absent one.
   */
  showClientActions?: boolean;
}) {
  const verification = VERIFICATION[profile.verification];

  return (
    <Card as="header">
      <div className="flex flex-wrap items-start gap-x-5 gap-y-4 p-4">
        <Avatar
          name={profile.displayName}
          src={profile.avatarUrl}
          size="xl"
          verification={profile.verification}
        />

        <div className="min-w-56 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.02em] text-ink">
              {profile.displayName}
            </h1>
            <span className="rounded border border-line bg-sunken px-1.5 py-0.5 font-num text-[12px] text-ink-muted">
              @{profile.primaryHandle}
            </span>
            <Badge tone={verification.tone} title={verification.note}>
              {verification.label}
            </Badge>
            {profile.isDemo && (
              <Badge
                tone="caution"
                title="A hand-built demonstration record. Its figures were chosen to exercise every panel, not measured from a platform, and it is excluded from cohort benchmarks."
              >
                Demo record
              </Badge>
            )}
          </div>

          <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-muted">
            {profile.countryName && (
              <Meta icon={Globe} label="Country">
                {profile.countryName}
              </Meta>
            )}
            {profile.languages.length > 0 && (
              <Meta icon={Languages} label="Languages">
                {profile.languages.join(", ").toUpperCase()}
              </Meta>
            )}
            <Meta icon={Tag} label="Categories">
              {profile.categories.map((category) => CATEGORY_LABEL[category]).join(", ")}
            </Meta>
          </dl>

          <ul className="flex flex-wrap items-center gap-2 pt-0.5">
            {profile.socialAccounts.map((account) => (
              <li key={account.id}>
                <a
                  href={account.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2 py-1 text-[12px] transition-colors hover:bg-sunken"
                >
                  <span className="font-medium text-ink">
                    {PLATFORM_LABEL[account.platform]}
                  </span>
                  <span className="font-num tabular-nums text-ink-muted">
                    {formatCompact(account.followers)}
                  </span>
                  {account.isPrimary && (
                    <span className="rounded bg-sunken px-1 text-[10px] uppercase tracking-wide text-ink-muted">
                      Primary
                    </span>
                  )}
                  {account.isConnected && (
                    <span
                      className="size-1.5 rounded-full bg-verified"
                      title="Connected through OAuth"
                      aria-label="Connected through OAuth"
                    />
                  )}
                  {account.needsReauth && (
                    <span className="text-caution" title="Re-authorisation required">
                      ⚠
                    </span>
                  )}
                  <ExternalLink className="size-3 text-ink-subtle" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex min-w-0 max-w-full flex-col items-start gap-2 sm:items-end">
          {showClientActions && <ProfileActions profile={profile} />}
          <Freshness at={profile.lastRefreshedAt} prefix="Data refreshed" />
          <RefreshButton influencerId={profile.id} />
        </div>
      </div>

      {profile.bio && (
        <p className="border-t border-line px-4 py-2.5 text-[13px] text-ink-muted">
          {profile.bio}
        </p>
      )}

      {profile.verification !== "verified" && (
        <p className="border-t border-line bg-sunken/50 px-4 py-2 text-[12px] text-ink-muted">
          {verification.note}{" "}
          <Link href="/help/verification" className="rounded font-medium text-brand-ink underline underline-offset-2">
            How verification works
          </Link>
        </p>
      )}
    </Card>
  );
}

function Meta({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Globe;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="size-3.5 shrink-0 text-ink-subtle" aria-hidden />
      <dt className="sr-only">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
