import type { Brand, BrandInput, BrandPatch, BrandRollup } from "@/lib/contracts/agency";
import type { SessionUser } from "@/lib/contracts/auth";
import { ApiFailure, assertTenantAccess } from "@/server/auth/rbac";
import { appRows, persist } from "@/server/data/app-store";
import { listCampaigns, listShortlists, shortlistCreatorIds } from "@/server/repositories/workspace-repository";
import { currentBrandIds, findOrg, listUsers, setUserBrands } from "@/server/repositories/user-repository";

/* ---------------------------------------------------------------------------
 * Brands: the agency's clients, inside the agency's own organisation.
 *
 * See src/lib/contracts/agency.ts for why a brand is not a tenant. Two rules
 * hold this together:
 *
 *   - A brand never crosses an organisation. `assertTenantAccess` runs first
 *     on every read and write here, exactly as it does for a campaign.
 *   - A team member restricted to brands sees *only* those brands' work, and
 *     that includes work with no brand at all: an unassigned shortlist is the
 *     agency's own, and an account manager for one client has no business in
 *     it. The restriction travels on the session so every list can apply it
 *     without asking this service.
 * ------------------------------------------------------------------------ */

export const AGENCY_VERSION = "agency-1.0.0";

const brands = () => appRows<Brand>("brands", () => []);

const nextId = () => `brand_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Every brand in the user's organisation they are allowed to see. */
export function listBrands(user: SessionUser, includeArchived = false): Brand[] {
  const allowed = currentBrandIds(user);
  return brands()
    .filter((brand) => brand.orgId === user.orgId)
    .filter((brand) => includeArchived || brand.status === "active")
    .filter((brand) => allowed.length === 0 || allowed.includes(brand.id))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getBrand(user: SessionUser, id: string): Brand | null {
  const brand = brands().find((entry) => entry.id === id);
  if (!brand) return null;
  assertTenantAccess(user, brand.orgId);
  assertBrandAccess(user, brand.id);
  return brand;
}

/**
 * Throws unless the user may work inside this brand. Called by anything that
 * writes a brandId onto a row, so a restricted member cannot file work under
 * a client they do not handle.
 */
export function assertBrandAccess(user: SessionUser, brandId: string | null): void {
  const allowed = currentBrandIds(user);
  if (allowed.length === 0) return;
  if (brandId === null || !allowed.includes(brandId)) {
    throw new ApiFailure("forbidden", "You do not have access to that client.");
  }
}

export function createBrand(user: SessionUser, input: BrandInput): Brand {
  // A member restricted to a set of clients cannot invent another one.
  if (currentBrandIds(user).length > 0) {
    throw new ApiFailure("forbidden", "Only an account owner can add a client.");
  }
  const existing = brands().find(
    (brand) => brand.orgId === user.orgId && brand.name.toLowerCase() === input.name.toLowerCase(),
  );
  if (existing) throw new ApiFailure("validation_failed", "A client with that name already exists.");

  const brand: Brand = {
    id: nextId(),
    orgId: user.orgId,
    name: input.name,
    logoUrl: input.logoUrl,
    contactName: input.contactName,
    contactEmail: input.contactEmail,
    reference: input.reference,
    status: "active",
    createdAt: new Date().toISOString(),
    createdByName: user.name,
  };
  brands().push(brand);
  persist("brands", [brand]);
  return brand;
}

export function updateBrand(user: SessionUser, id: string, patch: BrandPatch): Brand {
  const brand = brands().find((entry) => entry.id === id);
  if (!brand) throw new ApiFailure("not_found", "Client not found.");
  assertTenantAccess(user, brand.orgId);
  assertBrandAccess(user, brand.id);

  if (patch.name !== undefined) brand.name = patch.name;
  if (patch.logoUrl !== undefined) brand.logoUrl = patch.logoUrl;
  if (patch.contactName !== undefined) brand.contactName = patch.contactName;
  if (patch.contactEmail !== undefined) brand.contactEmail = patch.contactEmail;
  if (patch.reference !== undefined) brand.reference = patch.reference;
  // Archived rather than deleted: the campaigns and reports filed under a
  // client outlive the relationship, and a deleted brand would orphan them.
  if (patch.status !== undefined) brand.status = patch.status;
  persist("brands", [brand]);
  return brand;
}

/** The mark a report or proposal for this brand goes out under. */
export async function brandingFor(
  orgId: string,
  brandId: string | null,
): Promise<{ orgName: string; logoUrl: string | null }> {
  const org = await findOrg(orgId);
  const fallback = { orgName: org?.name ?? "", logoUrl: org?.logoUrl ?? null };
  if (!brandId) return fallback;
  const brand = brands().find((entry) => entry.id === brandId && entry.orgId === orgId);
  // A brand with no mark of its own falls back to the agency's rather than
  // going out unbranded.
  return brand ? { orgName: brand.name, logoUrl: brand.logoUrl ?? fallback.logoUrl } : fallback;
}

/* --- Roll-up ------------------------------------------------------------ */

/** One row per client: the whole book of work, summed. */
export function brandRollups(user: SessionUser): BrandRollup[] {
  const campaigns = listCampaigns(user);
  const shortlists = listShortlists(user);

  return listBrands(user).map((brand) => {
    const mine = campaigns.filter((campaign) => campaign.brandId === brand.id);
    const lists = shortlists.filter((shortlist) => shortlist.brandId === brand.id);
    const creators = new Set<string>();
    for (const shortlist of lists) for (const id of shortlistCreatorIds(user, shortlist.id)) creators.add(id);

    // A metric no platform reported stays absent: summing nulls as zero here
    // would publish a total nobody observed (D44).
    const sumOrNull = (read: (campaign: (typeof mine)[number]) => number | null): number | null =>
      mine.every((campaign) => read(campaign) === null)
        ? null
        : mine.reduce((total, campaign) => total + (read(campaign) ?? 0), 0);

    const withFulfilment = mine.filter((campaign) => campaign.fulfilmentPercent !== null);

    return {
      brand,
      campaigns: mine.length,
      activeCampaigns: mine.filter((campaign) => campaign.status === "live").length,
      shortlists: lists.length,
      creators: creators.size,
      attributedPosts: mine.reduce((total, campaign) => total + campaign.attributedPosts, 0),
      views: sumOrNull((campaign) => campaign.totalReach),
      engagements: sumOrNull((campaign) => campaign.totalEngagements),
      committed: mine.length === 0 ? null : mine.reduce((total, c) => total + (c.spentAmount ?? 0), 0),
      currency: mine[0]?.budgetCurrency ?? "INR",
      fulfilmentPercent:
        withFulfilment.length === 0
          ? null
          : Number(
              (
                withFulfilment.reduce((total, c) => total + (c.fulfilmentPercent ?? 0), 0) /
                withFulfilment.length
              ).toFixed(1),
            ),
    } satisfies BrandRollup;
  });
}

/* --- Team assignment ---------------------------------------------------- */

export async function listTeam(
  user: SessionUser,
): Promise<{ id: string; name: string; email: string; role: string; brandIds: string[] }[]> {
  const users = await listUsers(user.orgId);
  return users.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    brandIds: row.brandIds ?? [],
  }));
}

/** Limits a colleague to a set of clients. An empty list restores full access. */
export async function assignBrands(
  user: SessionUser,
  userId: string,
  brandIds: string[],
): Promise<string[]> {
  if (currentBrandIds(user).length > 0) {
    throw new ApiFailure("forbidden", "Only an account owner can change client access.");
  }
  const mine = new Set(listBrands(user, true).map((brand) => brand.id));
  const unknown = brandIds.filter((id) => !mine.has(id));
  if (unknown.length > 0) throw new ApiFailure("validation_failed", "Unknown client.");
  return setUserBrands(user.orgId, userId, [...new Set(brandIds)]);
}
