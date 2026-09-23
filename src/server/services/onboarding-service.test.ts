import { describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/lib/contracts/auth";

vi.mock("@/server/repositories/influencer-repository", () => ({
  toSummary: (id: string) =>
    id === "yt_real"
      ? { id, displayName: "Aria", primaryPlatform: "youtube", followers: 412_000 }
      : null,
}));

const USER = { orgId: "org_x", orgKind: "platform", name: "Marcus" } as SessionUser;

describe("creator onboarding", () => {
  it("keeps a stated follower count as a claim and never as a measurement", async () => {
    const svc = await import("./onboarding-service");
    const app = svc.startApplication({ name: "Aria", email: "aria@example.com" });
    svc.patchApplication(app.token, {
      socials: [{ platform: "youtube", handle: "@aria", statedFollowers: 9_000_000 }],
    });
    const before = svc.applicationByToken(app.token)!;
    // Nothing the applicant typed is treated as observed.
    expect(before.socials[0].statedFollowers).toBe(9_000_000);
    expect(before.socials[0].resolvedFollowers).toBeNull();

    svc.decideApplication(USER, app.id, { decision: "approve", linkedInfluencerId: "yt_real", note: "" });
    const after = svc.applicationByToken(app.token)!;
    // The measured figure is recorded beside the claim, not over it.
    expect(after.socials[0].statedFollowers).toBe(9_000_000);
    expect(after.socials[0].resolvedFollowers).toBe(412_000);
    expect(after.linkedInfluencerId).toBe("yt_real");
  });

  it("refuses to approve without linking to a real index record", async () => {
    const svc = await import("./onboarding-service");
    const app = svc.startApplication({ name: "Ghost", email: "ghost@example.com" });
    expect(() =>
      svc.decideApplication(USER, app.id, { decision: "approve", linkedInfluencerId: null }),
    ).toThrow();
    expect(() =>
      svc.decideApplication(USER, app.id, { decision: "approve", linkedInfluencerId: "not_in_index" }),
    ).toThrow();
  });

  it("closes the form once decided", async () => {
    const svc = await import("./onboarding-service");
    const app = svc.startApplication({ name: "Ben", email: "ben@example.com" });
    svc.decideApplication(USER, app.id, { decision: "reject", note: "Not a fit", linkedInfluencerId: null });
    // Editing after a decision would leave a record nobody reviewed.
    expect(svc.patchApplication(app.token, { bio: "changed" })).toBeNull();
  });

  it("never exposes payout details to a reviewer list", async () => {
    const svc = await import("./onboarding-service");
    const app = svc.startApplication({ name: "Cal", email: "cal@example.com" });
    svc.patchApplication(app.token, { payout: { legalName: "Cal Smith", taxId: "SECRET" } });
    const listed = svc.listApplications(USER).find((entry) => entry.id === app.id)!;
    expect(listed.payoutProvided).toBe(true);
    expect(JSON.stringify(listed)).not.toContain("SECRET");
    expect(JSON.stringify(listed)).not.toContain(app.token);
  });
});
