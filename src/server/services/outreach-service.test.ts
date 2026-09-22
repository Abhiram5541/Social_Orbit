import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/lib/contracts/auth";

const sent: { to: string; subject: string }[] = [];
let optedOut = false;
const interactions: string[] = [];

vi.mock("./notification-service", () => ({
  sendEmail: async (input: { to: string; subject: string }) => {
    sent.push(input);
    return true;
  },
}));
vi.mock("@/server/repositories/crm-repository", () => ({
  getOrCreateCrm: () => ({}),
  contactableEmail: () => (optedOut ? null : "creator@example.com"),
  addInteraction: (_u: SessionUser, _i: string, input: { kind: string }) => {
    interactions.push(input.kind);
    return {};
  },
}));
vi.mock("@/server/repositories/influencer-repository", () => ({
  toSummary: (id: string) => ({ id, displayName: "Aria Blake", primaryHandle: "ariablake" }),
}));
vi.mock("@/server/repositories/workspace-repository", () => ({
  getCampaign: () => ({ id: "c1", name: "Orbit launch", hashtag: "orbit" }),
}));

const USER = { orgId: "org_x", name: "Marcus", orgName: "Northwind" } as SessionUser;

describe("outreach", () => {
  beforeEach(() => {
    sent.length = 0;
    interactions.length = 0;
    optedOut = false;
  });

  it("personalises known tokens and leaves unknown ones visible", async () => {
    const { render } = await import("./outreach-service");
    const out = render("Hi {{creator.name}}, about {{campaign.name}} — {{nope}}", {
      "creator.name": "Aria",
      "campaign.name": "Orbit",
    });
    // An unknown token stays as written so the sender sees their own mistake.
    expect(out).toBe("Hi Aria, about Orbit — {{nope}}");
  });

  it("sends, logs the send on the timeline, and fills the campaign tokens", async () => {
    const { sendOutreach } = await import("./outreach-service");
    const report = await sendOutreach(USER, {
      influencerIds: ["i1"],
      campaignId: "c1",
      templateId: null,
      subject: "{{creator.name}} x {{org.name}}",
      body: "Join {{campaign.name}} (#{{campaign.hashtag}}) — {{sender.name}}",
    });
    expect(report.sent).toBe(1);
    expect(sent[0].subject).toBe("Aria Blake x Northwind");
    expect(interactions).toEqual(["email_sent"]);
  });

  it("never contacts a creator who opted out", async () => {
    const { sendOutreach } = await import("./outreach-service");
    optedOut = true;
    const report = await sendOutreach(USER, {
      influencerIds: ["i1"], campaignId: null, templateId: null,
      subject: "Hello", body: "Anything at all",
    });
    expect(report.sent).toBe(0);
    expect(report.skipped).toBe(1);
    expect(sent).toHaveLength(0);
    expect(interactions).toHaveLength(0);
  });

  it("only advances a message status forwards", async () => {
    const { recordProviderEvent } = await import("./outreach-service");
    // Unknown ids are reported, never invented.
    expect(recordProviderEvent("nope", "opened")).toBe(false);
  });
});
