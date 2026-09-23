import { z } from "zod";

/* ---------------------------------------------------------------------------
 * Agency workflow — brands inside one organisation.
 *
 * An agency runs campaigns *for* other companies. Giving each of those a
 * SENSO organisation of its own would be the obvious move and the wrong one:
 * the agency would lose the one view it actually needs (everything it runs,
 * across clients), its seats would multiply, and its team would sign in
 * somewhere different for every account.
 *
 * So a brand is a book of work *inside* the agency's org, not a tenant. Every
 * shortlist, campaign and report may name one; a team member may be limited
 * to some of them; and a report shared with a brand stakeholder carries that
 * brand's mark rather than the agency's. Tenant isolation is unchanged and
 * still lives in the repository layer — brand scoping sits inside it and
 * never replaces it.
 * ------------------------------------------------------------------------ */

export const BrandStatus = z.enum(["active", "archived"]);
export type BrandStatus = z.infer<typeof BrandStatus>;

export const Brand = z.object({
  id: z.string(),
  /** The agency organisation this brand belongs to. */
  orgId: z.string(),
  name: z.string(),
  /** Shown in place of the agency's mark on anything shared with this brand. */
  logoUrl: z.string().nullable(),
  /** Who at the brand receives reports. */
  contactName: z.string().nullable(),
  contactEmail: z.string().nullable(),
  /** The agency's own reference — a PO, an account code. */
  reference: z.string().nullable(),
  status: BrandStatus,
  createdAt: z.string().datetime(),
  createdByName: z.string(),
});
export type Brand = z.infer<typeof Brand>;

export const BrandInput = z.object({
  name: z.string().trim().min(2, "Name the brand").max(120),
  logoUrl: z.string().trim().max(500).nullable().default(null),
  contactName: z.string().trim().max(120).nullable().default(null),
  contactEmail: z.string().trim().toLowerCase().email().nullable().default(null),
  reference: z.string().trim().max(60).nullable().default(null),
});
export type BrandInput = z.infer<typeof BrandInput>;

/**
 * Fields are optional *without* a default: `BrandInput.partial()` would keep
 * the `.default(null)` on each one, so a patch that named none of them would
 * parse as "set all of these to null" and quietly wipe the record.
 */
export const BrandPatch = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  logoUrl: z.string().trim().max(500).nullable().optional(),
  contactName: z.string().trim().max(120).nullable().optional(),
  contactEmail: z.string().trim().toLowerCase().email().nullable().optional(),
  reference: z.string().trim().max(60).nullable().optional(),
  status: BrandStatus.optional(),
});
export type BrandPatch = z.infer<typeof BrandPatch>;

/** What an agency sees per client: the book of work, rolled up. */
export const BrandRollup = z.object({
  brand: Brand,
  campaigns: z.number().int(),
  activeCampaigns: z.number().int(),
  shortlists: z.number().int(),
  creators: z.number().int(),
  attributedPosts: z.number().int(),
  /** Null when no platform in the book reported a view count. */
  views: z.number().nullable(),
  engagements: z.number().nullable(),
  committed: z.number().nullable(),
  currency: z.string(),
  /** Deliverables met, across the brand's campaigns. Null with none defined. */
  fulfilmentPercent: z.number().nullable(),
});
export type BrandRollup = z.infer<typeof BrandRollup>;

/** Who may see which brands. An empty list means the whole organisation. */
export const BrandAssignment = z.object({
  userId: z.string(),
  brandIds: z.array(z.string()),
});
export type BrandAssignment = z.infer<typeof BrandAssignment>;
