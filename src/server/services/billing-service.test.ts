import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, unknown[]>();
vi.mock("@/server/data/app-store", () => ({
  appRows: (kind: string) => store.get(kind) ?? store.set(kind, []).get(kind)!,
  persist: () => {},
  unpersist: () => {},
}));

let orgPlan: "free" | "growth" | "enterprise" = "growth";
let activeUsers = 1;
vi.mock("@/server/repositories/user-repository", () => ({
  findOrg: async () => ({ id: "org_a", name: "A", kind: "client", plan: orgPlan, createdAt: "", seatsUsed: activeUsers }),
  listUsers: async () =>
    Array.from({ length: activeUsers }, (_, index) => ({ id: `u${index}`, status: "active" })),
  updateOrg: async (_id: string, patch: { plan?: typeof orgPlan }) => {
    if (patch.plan) orgPlan = patch.plan;
  },
}));
vi.mock("./notification-service", () => ({ sendEmail: async () => true }));

const owner = {
  id: "u0",
  email: "owner@a.example",
  name: "Owner",
  avatarUrl: null,
  role: "client_owner" as const,
  orgId: "org_a",
  orgName: "A",
  orgKind: "client" as const,
  plan: "growth" as const,
  influencerId: null,
};

describe("plan management", () => {
  beforeEach(() => {
    store.clear();
    orgPlan = "growth";
    activeUsers = 1;
  });

  it("schedules a downgrade for the end of the period rather than applying it now", async () => {
    const billing = await import("./billing-service");
    const change = await billing.requestPlanChange(owner, "free");
    expect(change.status).toBe("scheduled");
    expect(change.effectiveAt).not.toBeNull();
    // Nothing changed yet: the customer keeps the period they already have.
    expect(orgPlan).toBe("growth");
  });

  it("refuses a downgrade that would leave more accounts than the plan has seats", async () => {
    const billing = await import("./billing-service");
    activeUsers = 4; // free includes 2
    await expect(billing.requestPlanChange(owner, "free")).rejects.toThrow(/seats/i);
  });

  it("holds a due downgrade when the org has grown past the smaller plan", async () => {
    const billing = await import("./billing-service");
    const change = await billing.requestPlanChange(owner, "free");
    activeUsers = 9;
    change.effectiveAt = new Date(Date.now() - 1000).toISOString();
    expect(await billing.applyDuePlanChanges()).toBe(0);
    expect(orgPlan).toBe("growth");
    expect(change.status).toBe("scheduled");
  });

  it("applies a due downgrade that still fits", async () => {
    const billing = await import("./billing-service");
    const change = await billing.requestPlanChange(owner, "free");
    change.effectiveAt = new Date(Date.now() - 1000).toISOString();
    expect(await billing.applyDuePlanChanges()).toBe(1);
    expect(orgPlan).toBe("free");
  });

  it("leaves an upgrade pending — there is no processor to charge with", async () => {
    const billing = await import("./billing-service");
    const change = await billing.requestPlanChange(owner, "enterprise");
    expect(change.status).toBe("pending");
    expect(orgPlan).toBe("growth");
  });

  it("gates a feature the plan does not include, and never gates platform staff", async () => {
    const billing = await import("./billing-service");
    expect(() => billing.assertFeature({ ...owner, plan: "free" }, "campaigns")).toThrow();
    expect(() =>
      billing.assertFeature({ ...owner, plan: "free", orgKind: "platform" }, "campaigns"),
    ).not.toThrow();
    expect(() => billing.assertFeature(owner, "campaigns")).not.toThrow();
  });
});
