import { describe, expect, it } from "vitest";
import { parseAsk, refineAsk } from "./ask-service";

const q = (text: string) => parseAsk(text).query as unknown as Record<string, string>;

describe("Ask SENSO", () => {
  it("parses the specification's own example", () => {
    const result = parseAsk(
      "Find 20 technology creators in Delhi with 50K–500K followers and strong engagement",
    );
    const query = result.query as unknown as Record<string, string>;
    expect(query.pageSize).toBe("20");
    expect(query.category).toBe("technology");
    expect(query.followersMin).toBe("50000");
    expect(query.followersMax).toBe("500000");
    // "strong engagement" maps to a threshold the reader can see, not a
    // private one.
    expect(query.engagementMin).toBe("3");
    // Delhi is not a filter any API exposes, so it survives as a keyword —
    // which is how place mentions are matched.
    expect(query.q).toContain("delhi");
  });

  it("reads Indian number words and one-sided bounds", () => {
    expect(q("beauty creators over 1 lakh followers").followersMin).toBe("100000");
    expect(q("gaming creators under 2 crore followers").followersMax).toBe("20000000");
    expect(q("food creators above 500k followers").followersMin).toBe("500000");
  });

  it("does not turn a range into two separate minimums", () => {
    const query = q("creators with 10k to 50k followers");
    expect(query.followersMin).toBe("10000");
    expect(query.followersMax).toBe("50000");
  });

  it("shows every criterion with the words that produced it", () => {
    const result = parseAsk("verified fitness creators in India sorted by engagement");
    const fields = result.criteria.map((c) => c.field);
    expect(fields).toContain("verification");
    expect(fields).toContain("category");
    expect(fields).toContain("country");
    expect(result.criteria.find((c) => c.field === "country")!.from).toBe("india");
    expect(result.query.sort).toBe("engagement_desc");
  });

  it("refines rather than restarting", () => {
    const first = parseAsk("beauty and fitness creators in India");
    const narrowed = refineAsk(first.query, "under 1 lakh followers");
    const q2 = narrowed.query as unknown as Record<string, string>;
    // The earlier country survives the follow-up.
    expect(q2.country).toBe("IN");
    expect(q2.followersMax).toBe("100000");

    const dropped = refineAsk(first.query, "remove beauty");
    expect((dropped.query as unknown as Record<string, string>).category).toBe("fitness");
  });
});

describe("scale suffixes", () => {
  it("reads a lakh and a crore whole, rather than matching the shorter suffix first", () => {
    const lakh = parseAsk("beauty creators in india over 1 lakh followers");
    expect(String(lakh.query.followersMin)).toBe("100000");
    expect(lakh.unparsed).not.toContain("akh");
    // The leftovers must not become a free-text filter either.
    expect(lakh.query.q ?? "").not.toContain("akh");

    expect(String(parseAsk("creators under 2 crore followers").query.followersMax)).toBe("20000000");
    expect(String(parseAsk("50k to 500k followers").query.followersMin)).toBe("50000");
    expect(String(parseAsk("50k to 500k followers").query.followersMax)).toBe("500000");
  });
});
