import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/lib/contracts/auth";

const CAMPAIGN = {
  id: "c1", orgId: "org_x", name: "Orbit launch",
  participants: [
    { influencerId: "i1", displayName: "Aria", primaryHandle: "aria", followers: 1, healthScore: 80, agreedRate: 100, currency: "INR" },
    { influencerId: "i2", displayName: "Ben", primaryHandle: "ben", followers: 2, healthScore: 70, agreedRate: 200, currency: "INR" },
  ],
};

vi.mock("@/server/repositories/workspace-repository", () => ({ getCampaign: () => CAMPAIGN }));
vi.mock("@/server/repositories/influencer-repository", () => ({ toSummary: () => null }));
vi.mock("@/server/repositories/crm-repository", () => ({ noteIfTracked: () => {} }));

const USER = { orgId: "org_x", name: "Marcus" } as SessionUser;

describe("campaign proposals", () => {
  it("snapshots what was proposed and completes only when every line is decided", async () => {
    const svc = await import("./campaign-workflow-service");
    const proposal = svc.createProposal(USER, { campaignId: "c1", expiresOn: null });
    // Rates travel with the document: the public link has no session to
    // re-derive them with.
    expect(proposal.lines.map((l) => l.agreedRate)).toEqual([100, 200]);
    expect(proposal.campaignName).toBe("Orbit launch");

    svc.decideProposalLine(proposal.token, { influencerId: "i1", decision: "approved" });
    expect(svc.proposalByToken(proposal.token)!.completedAt).toBeNull();

    const done = svc.decideProposalLine(proposal.token, { influencerId: "i2", decision: "rejected" });
    // Silence is not approval — it completes on the last decision, not a date.
    expect(done!.completedAt).not.toBeNull();
  });

  it("refuses an expired link", async () => {
    const svc = await import("./campaign-workflow-service");
    const proposal = svc.createProposal(USER, { campaignId: "c1", expiresOn: "2020-01-01" });
    expect(svc.proposalByToken(proposal.token)).toBeNull();
    expect(svc.decideProposalLine(proposal.token, { influencerId: "i1", decision: "approved" })).toBeNull();
  });
});

describe("content submissions", () => {
  it("opens a new revision on changes requested, not on approval", async () => {
    const svc = await import("./campaign-workflow-service");
    const submission = svc.createSubmission(USER, {
      campaignId: "c1", influencerId: "i1", deliverableId: null,
      platform: "youtube", format: "video", caption: "Draft", mediaUrl: null,
    });
    expect(submission.revision).toBe(1);

    const changed = svc.reviewSubmission(USER, submission.id, { decision: "request_changes", comment: "Disclosure earlier" });
    expect(changed.state).toBe("changes_requested");
    expect(changed.revision).toBe(2);

    const approved = svc.reviewSubmission(USER, submission.id, { decision: "approve" });
    // Approving the reviewed draft does not start another revision.
    expect(approved.revision).toBe(2);
    expect(approved.events).toHaveLength(3);
  });
});
