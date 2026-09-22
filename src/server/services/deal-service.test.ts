import { describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/lib/contracts/auth";
import type { Compensation, UsageRights } from "@/lib/contracts/deal";

vi.mock("@/server/repositories/workspace-repository", () => ({
  getCampaign: () => ({
    id: "c1", orgId: "org_x", name: "Orbit", hashtag: "orbit",
    budgetCurrency: "INR", budgetAmount: 1_000_000, deliverables: [],
    participants: [{ influencerId: "i1", primaryHandle: "aria", agreedRate: 400_000 }],
  }),
}));
vi.mock("@/server/repositories/influencer-repository", () => ({ toSummary: () => ({ displayName: "Aria" }) }));
vi.mock("@/server/repositories/crm-repository", () => ({ noteIfTracked: () => {} }));
vi.mock("./outreach-service", () => ({ render: (t: string) => t }));

const USER = { orgId: "org_x", name: "Marcus", orgName: "Northwind" } as SessionUser;
const COMP: Compensation = {
  model: "flat_fee", currency: "INR", baseAmount: 400_000, commissionPct: null,
  bonusAmount: null, bonusCondition: null, giftingValue: null, notes: null,
};
const RIGHTS: UsageRights = {
  territories: ["IN"], durationMonths: 6, channels: ["paid social"], paidMedia: true,
  whitelisting: false, exclusivity: null, exclusivityEndsOn: null, expiresOn: null,
};
const base = { campaignId: "c1", influencerId: "i1", templateId: null, body: "x".repeat(30),
  compensation: COMP, usageRights: RIGHTS, deliverablesSummary: "", startsOn: "2026-09-01", endsOn: "2026-09-30" };

describe("contracts", () => {
  it("derives the usage-rights expiry from the window and duration", async () => {
    const svc = await import("./deal-service");
    const contract = svc.createContract(USER, { ...base, expiresOn: null });
    // Six months after the campaign ends.
    expect(contract.usageRights.expiresOn).toBe("2027-03-30");
  });

  it("never treats an expired contract as signed", async () => {
    const svc = await import("./deal-service");
    const contract = svc.createContract(USER, { ...base, expiresOn: "2020-01-01" });
    const sent = svc.sendContract(USER, contract.id);
    expect(svc.contractByToken(sent.signToken!)!.status).toBe("expired");
    expect(svc.signContract(sent.signToken!, { signatureName: "Aria B", accept: true })).toBeNull();
  });

  it("records a signature with the name that gave it", async () => {
    const svc = await import("./deal-service");
    const contract = svc.createContract(USER, { ...base, expiresOn: null });
    const sent = svc.sendContract(USER, contract.id);
    const signed = svc.signContract(sent.signToken!, { signatureName: "Aria Blake", accept: true })!;
    expect(signed.status).toBe("signed");
    expect(signed.signatureName).toBe("Aria Blake");
    // Signing twice is refused rather than re-recorded.
    expect(svc.signContract(sent.signToken!, { signatureName: "Someone Else", accept: true })).toBeNull();
  });
});

describe("payments", () => {
  it("requires approval before payment, and records who did each", async () => {
    const svc = await import("./deal-service");
    const payment = svc.createPayment(USER, {
      campaignId: "c1", influencerId: "i1", contractId: null,
      amount: 400_000, currency: "INR", description: "Flat fee", dueOn: null,
    });
    expect(payment.status).toBe("scheduled");
    // Paying an unapproved amount is refused: approval and payment are
    // separate actions on purpose.
    expect(() => svc.actOnPayment(USER, payment.id, { action: "mark_paid" })).toThrow();

    const approved = svc.actOnPayment(USER, payment.id, { action: "approve" });
    expect(approved.approvedByName).toBe("Marcus");
    const paid = svc.actOnPayment(USER, payment.id, { action: "mark_paid", reference: "NEFT-991" });
    expect(paid.status).toBe("paid");
    expect(paid.reference).toBe("NEFT-991");
  });

  it("counts only recorded payments as paid", async () => {
    const svc = await import("./deal-service");
    const spend = svc.campaignSpend(USER, "c1");
    expect(spend.committed).toBe(400_000);
    expect(spend.paid).toBe(400_000); // the one paid above
    expect(spend.outstanding).toBe(0);
  });
});
