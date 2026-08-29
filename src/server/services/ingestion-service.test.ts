import { describe, expect, it } from "vitest";
import { riskLevel } from "@/server/scoring/formulas";
import { categoriesFromTopics, extractHashtags } from "./ingestion-service";

describe("categoriesFromTopics", () => {
  it("maps YouTube's own topic URLs onto platform categories", () => {
    expect(
      categoriesFromTopics([
        "https://en.wikipedia.org/wiki/Technology",
        "https://en.wikipedia.org/wiki/Lifestyle_(sociology)",
      ]),
    ).toEqual(["technology", "lifestyle"]);
  });

  it("de-duplicates topics that collapse to the same category", () => {
    expect(
      categoriesFromTopics([
        "https://en.wikipedia.org/wiki/Action_game",
        "https://en.wikipedia.org/wiki/Role-playing_video_game",
      ]),
    ).toEqual(["gaming"]);
  });

  it("drops an unmapped topic rather than forcing it into a category", () => {
    // A wrong category puts the creator in the wrong cohort, which corrupts
    // the benchmark medians of everyone genuinely in it.
    expect(categoriesFromTopics(["https://en.wikipedia.org/wiki/Politics"])).toEqual([]);
    expect(categoriesFromTopics([])).toEqual([]);
  });
});

describe("extractHashtags", () => {
  it("lowercases before de-duplicating, and keeps non-ASCII tags", () => {
    expect(extractHashtags("Ship it #TypeScript #typescript #日本語")).toEqual([
      "#typescript",
      "#日本語",
    ]);
  });

  it("ignores a # inside a word", () => {
    // Campaign attribution matches on these, so a false tag attributes a post
    // to a campaign it has nothing to do with.
    expect(extractHashtags("see issue no#match here")).toEqual([]);
    expect(extractHashtags("start #real mid#fake")).toEqual(["#real"]);
  });

  it("returns nothing for a description with no tags", () => {
    expect(extractHashtags("Links in the description.")).toEqual([]);
  });
});

describe("riskLevel with nothing measurable", () => {
  it("is unknown, not low, when no audience-quality signal exists", () => {
    // The case every public-API ingest lands in. "Low" here would be a safety
    // claim manufactured out of missing data.
    expect(
      riskLevel({ botRisk: null, inactiveAudience: null, viewAnomaly: 94, brandSafety: null }),
    ).toBe("unknown");
  });

  it("lets brand safety raise a risk level but never clear one", () => {
    // Brand safety judges content; a risk level claims something about the
    // audience. A clean content read must not certify an audience nobody
    // measured — but a damning one still has to be able to escalate.
    expect(
      riskLevel({ botRisk: null, inactiveAudience: null, viewAnomaly: 95, brandSafety: 95 }),
    ).toBe("unknown");

    expect(
      riskLevel({ botRisk: null, inactiveAudience: null, viewAnomaly: 95, brandSafety: 20 }),
    ).toBe("high");
  });

  it("grades normally as soon as one signal is measurable", () => {
    expect(
      riskLevel({ botRisk: 85, inactiveAudience: null, viewAnomaly: null, brandSafety: null }),
    ).toBe("high");
    expect(
      riskLevel({ botRisk: 5, inactiveAudience: null, viewAnomaly: null, brandSafety: null }),
    ).toBe("low");
  });
});
