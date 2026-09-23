import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, unknown[]>();
vi.mock("@/server/data/app-store", () => ({
  appRows: (kind: string) => store.get(kind) ?? store.set(kind, []).get(kind)!,
  persist: () => {},
  unpersist: () => {},
}));
vi.mock("@/server/repositories/workspace-repository", () => ({
  listCampaigns: () => [],
  listShortlists: () => [],
  shortlistCreatorIds: () => [],
}));
vi.mock("@/server/repositories/user-repository", () => ({
  findOrg: async () => ({ id: "org_a", name: "Agency", logoUrl: "/brand/agency.png" }),
  listUsers: async () => [],
  setUserBrands: async (_o: string, _u: string, ids: string[]) => ids,
  // The real one reads the user record; here the session copy is the record.
  currentBrandIds: (user: { brandIds?: string[] | null }) => user.brandIds ?? [],
}));

const owner = {
  id: "u0",
  email: "o@a.example",
  name: "Owner",
  avatarUrl: null,
  role: "client_owner" as const,
  orgId: "org_a",
  orgName: "Agency",
  orgKind: "client" as const,
  plan: "growth" as const,
  influencerId: null,
};

describe("agency brands", () => {
  beforeEach(() => store.clear());

  it("hides every other client from a restricted member, including unfiled work", async () => {
    const agency = await import("./agency-service");
    const alpha = agency.createBrand(owner, {
      name: "Alpha",
      logoUrl: null,
      contactName: null,
      contactEmail: null,
      reference: null,
    });
    agency.createBrand(owner, {
      name: "Beta",
      logoUrl: null,
      contactName: null,
      contactEmail: null,
      reference: null,
    });

    const member = { ...owner, id: "u1", brandIds: [alpha.id] };
    expect(agency.listBrands(member).map((brand) => brand.name)).toEqual(["Alpha"]);
    expect(() => agency.assertBrandAccess(member, alpha.id)).not.toThrow();
    // Work filed under no client is the agency's own, not this member's.
    expect(() => agency.assertBrandAccess(member, null)).toThrow();
    expect(() => agency.createBrand(member, { name: "Gamma", logoUrl: null, contactName: null, contactEmail: null, reference: null })).toThrow();
  });

  it("sends a brand's report under the brand's mark, and falls back to the agency's", async () => {
    const agency = await import("./agency-service");
    const alpha = agency.createBrand(owner, {
      name: "Alpha",
      logoUrl: "/brand/alpha.png",
      contactName: null,
      contactEmail: null,
      reference: null,
    });
    expect(await agency.brandingFor("org_a", alpha.id)).toEqual({
      orgName: "Alpha",
      logoUrl: "/brand/alpha.png",
    });
    expect(await agency.brandingFor("org_a", null)).toEqual({
      orgName: "Agency",
      logoUrl: "/brand/agency.png",
    });
    // A brand from another organisation is not readable through this one.
    expect(await agency.brandingFor("org_b", alpha.id)).toEqual({
      orgName: "Agency",
      logoUrl: "/brand/agency.png",
    });
  });
});
