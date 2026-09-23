import { randomBytes } from "node:crypto";
import type { SessionUser } from "@/lib/contracts/auth";
import type {
  Application,
  ApplicationDecisionInput,
  ApplicationPatch,
  ApplicationStartInput,
  ApplicationStep,
  ApplicationSummary,
} from "@/lib/contracts/onboarding";
import { ApiFailure, assertTenantAccess } from "@/server/auth/rbac";
import { appRows, persist } from "@/server/data/app-store";
import { toSummary } from "@/server/repositories/influencer-repository";

/* ---------------------------------------------------------------------------
 * Creator applications.
 *
 * A creator applies through a link and fills in what they know; a person
 * reviews it and decides. Nothing an applicant types reaches the index.
 *
 * That last rule is the whole design. An applicant's stated follower count
 * is kept beside the figure the connector actually read, labelled as a claim,
 * and approval *links* the application to an existing index record rather
 * than creating one from the form. A directory is built from what people say
 * about themselves; this product is built from what the platforms report, and
 * an onboarding form is exactly where that distinction is most tempting to
 * lose.
 * ------------------------------------------------------------------------ */

export const ONBOARDING_VERSION = "onboarding-1.0.0";

type ApplicationRow = Application;

const applications = () => appRows<ApplicationRow>("applications", () => []);

const nextId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const EMPTY_PAYOUT: Application["payout"] = {
  legalName: null,
  country: null,
  taxId: null,
  accountLast4: null,
  bankName: null,
  currency: null,
};

/** Payout details never leave the server for a client-side reviewer. */
function toSummaryView(row: ApplicationRow): ApplicationSummary {
  const { token: _t, payout, ...rest } = row;
  void _t;
  return {
    ...rest,
    payoutProvided: Object.values(payout).some((value) => value !== null),
  };
}

/** Which sections are filled in, for the applicant's own progress. */
function completedSteps(row: ApplicationRow): ApplicationStep[] {
  const done: ApplicationStep[] = [];
  if (row.name && row.email && row.country) done.push("profile");
  if (row.socials.length > 0) done.push("socials");
  if (row.payout.legalName && row.payout.country) done.push("payout");
  if (row.status !== "draft") done.push("review");
  return done;
}

/* --- Applying ----------------------------------------------------------- */

export function startApplication(
  input: ApplicationStartInput,
  orgId: string | null = null,
): Application {
  const now = new Date().toISOString();
  const row: ApplicationRow = {
    id: nextId("app"),
    orgId,
    token: randomBytes(24).toString("base64url"),
    status: "draft",
    name: input.name,
    email: input.email,
    phone: null,
    country: null,
    bio: null,
    categories: [],
    socials: [],
    payout: EMPTY_PAYOUT,
    completed: [],
    reviewNote: null,
    reviewedByName: null,
    reviewedAt: null,
    linkedInfluencerId: null,
    createdAt: now,
    updatedAt: now,
  };
  row.completed = completedSteps(row);
  applications().push(row);
  persist("applications", [row]);
  return row;
}

/** The applicant's own view, by the token in their link. */
export function applicationByToken(token: string): Application | null {
  return applications().find((row) => row.token === token) ?? null;
}

export function patchApplication(token: string, patch: ApplicationPatch): Application | null {
  const row = applications().find((entry) => entry.token === token);
  if (!row) return null;
  // Once decided, the form is closed: an applicant editing their answers
  // after a decision would leave a record nobody actually reviewed.
  if (row.status === "approved" || row.status === "rejected") return null;

  if (patch.phone !== undefined) row.phone = patch.phone;
  if (patch.country !== undefined) row.country = patch.country;
  if (patch.bio !== undefined) row.bio = patch.bio;
  if (patch.categories) row.categories = [...new Set(patch.categories)];
  if (patch.socials) {
    row.socials = patch.socials.map((social) => {
      // A handle typed by an applicant is resolved against the index, not
      // trusted: if the platform never reported this account, it stays
      // unresolved and the stated figure stays a claim.
      const existing = row.socials.find(
        (entry) => entry.platform === social.platform && entry.handle === social.handle,
      );
      return {
        platform: social.platform,
        handle: social.handle.replace(/^@/, ""),
        statedFollowers: social.statedFollowers,
        resolvedInfluencerId: existing?.resolvedInfluencerId ?? null,
        resolvedFollowers: existing?.resolvedFollowers ?? null,
      };
    });
  }
  if (patch.payout) row.payout = { ...row.payout, ...patch.payout };
  if (patch.submit && row.status === "draft") row.status = "submitted";

  row.completed = completedSteps(row);
  row.updatedAt = new Date().toISOString();
  persist("applications", [row]);
  return row;
}

/* --- Reviewing ---------------------------------------------------------- */

export function listApplications(
  user: SessionUser,
  status?: Application["status"],
): ApplicationSummary[] {
  return applications()
    .filter((row) =>
      // Platform staff review every application; a client organisation sees
      // only the ones its own invite link produced.
      user.orgKind === "platform" ? true : row.orgId === user.orgId,
    )
    .filter((row) => !status || row.status === status)
    .map(toSummaryView)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function decideApplication(
  user: SessionUser,
  id: string,
  input: ApplicationDecisionInput,
): ApplicationSummary {
  const row = applications().find((entry) => entry.id === id);
  if (!row) throw new ApiFailure("not_found", "Application not found.");
  if (row.orgId) assertTenantAccess(user, row.orgId);

  if (input.decision === "approve") {
    if (!input.linkedInfluencerId) {
      throw new ApiFailure(
        "validation_failed",
        "Approving links the applicant to the creator record the platforms reported. Pick one — an application does not create an index record.",
      );
    }
    const summary = toSummary(input.linkedInfluencerId);
    if (!summary) throw new ApiFailure("validation_failed", "That creator is not in the index.");

    row.linkedInfluencerId = input.linkedInfluencerId;
    row.status = "approved";
    // The measured figure is recorded beside the claim, so the difference
    // between the two stays visible rather than being quietly reconciled.
    row.socials = row.socials.map((social) =>
      social.platform === summary.primaryPlatform
        ? {
            ...social,
            resolvedInfluencerId: summary.id,
            resolvedFollowers: summary.followers,
          }
        : social,
    );
  } else {
    row.status = input.decision === "reject" ? "rejected" : "in_review";
  }

  row.reviewNote = input.note?.trim() || null;
  row.reviewedByName = user.name;
  row.reviewedAt = new Date().toISOString();
  row.updatedAt = row.reviewedAt;
  row.completed = completedSteps(row);
  persist("applications", [row]);
  return toSummaryView(row);
}
