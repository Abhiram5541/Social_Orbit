import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { CreatorEnrichment, SAFETY_CHECKS } from "./enrichment";
import { AiUnavailable, extract } from "./openai";

/**
 * What is asserted here is the boundary, not the model.
 *
 * A classification layer is only safe if malformed, refused or truncated
 * output is rejected rather than stored — a half-parsed response written into
 * the database is a fabricated fact with a version stamp on it. The live call
 * is exercised by `POST /api/internal/ai/enrich`, which spends real tokens.
 */

const Shape = z.object({ verdict: z.string(), score: z.number().min(0).max(100) });

describe("extract", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  function respond(status: number, body: unknown) {
    fetchMock.mockResolvedValue({ ok: status < 400, status, json: async () => body });
  }

  function completion(content: string | null, extra: Record<string, unknown> = {}) {
    return {
      model: "gpt-5.1-2025-11-13",
      choices: [{ finish_reason: "stop", message: { content, ...extra } }],
      usage: { total_tokens: 128 },
    };
  }

  const call = () =>
    extract(Shape, { schemaName: "test", system: "s", user: "u" });

  it("returns the parsed object with the model and versions that produced it", async () => {
    respond(200, completion(JSON.stringify({ verdict: "safe", score: 91 })));
    const result = await call();

    expect(result.value).toEqual({ verdict: "safe", score: 91 });
    // Provenance is not optional: DPR §7 requires every AI output to record
    // which model and prompt produced it.
    expect(result.model).toBe("gpt-5.1-2025-11-13");
    expect(result.promptVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(result.totalTokens).toBe(128);
  });

  it("sends a strict json_schema so the API itself rejects off-schema output", async () => {
    respond(200, completion(JSON.stringify({ verdict: "safe", score: 1 })));
    await call();

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.response_format.type).toBe("json_schema");
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(body.response_format.json_schema.schema).toMatchObject({ type: "object" });
  });

  it("rejects output that does not satisfy the schema", async () => {
    // The API promised strict mode; it is still not taken at its word.
    respond(200, completion(JSON.stringify({ verdict: "safe", score: 900 })));
    await expect(call()).rejects.toMatchObject({ reason: "upstream_error" });
  });

  it("rejects content that is not JSON at all", async () => {
    respond(200, completion("I'd rather explain this in prose."));
    await expect(call()).rejects.toBeInstanceOf(AiUnavailable);
  });

  it("surfaces a refusal as a refusal", async () => {
    respond(200, completion(null, { refusal: "I can't help with that." }));
    await expect(call()).rejects.toMatchObject({ reason: "refused" });
  });

  it("explains an empty response rather than reporting it as malformed", async () => {
    // A reasoning model that spends its whole budget thinking returns no
    // content with finish_reason "length". Saying so is the difference between
    // a one-line config fix and an afternoon.
    respond(200, {
      model: "gpt-5.1",
      choices: [{ finish_reason: "length", message: { content: null } }],
      usage: { total_tokens: 4096 },
    });
    await expect(call()).rejects.toThrow(/no content.*length/i);
  });

  it("distinguishes a rejected key from an exhausted rate limit", async () => {
    respond(401, { error: { message: "Incorrect API key provided" } });
    await expect(call()).rejects.toMatchObject({ reason: "credentials_missing" });

    respond(429, { error: { message: "Rate limit reached" } });
    await expect(call()).rejects.toMatchObject({ reason: "rate_limited" });
  });

  it("refuses to call the API without a key", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    await expect(call()).rejects.toMatchObject({ reason: "credentials_missing" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("the enrichment schema", () => {
  it("has no field that could carry a metric the platform did not observe", () => {
    // CLAUDE.md §7: the model may classify, never measure. A field that cannot
    // be requested cannot be hallucinated into the database, so the guarantee
    // is enforced by the schema's shape rather than by the prompt.
    const fields = Object.keys(CreatorEnrichment.shape);
    const forbidden = /follower|subscriber|view|engagement|reach|impression|demographic|bot|fake|audience(Size|Age|Gender|Country)/i;

    expect(fields.filter((field) => forbidden.test(field))).toEqual([]);
  });

  const valid = (overrides: Record<string, unknown> = {}) => ({
    categories: ["technology"],
    creatorType: "reviewer",
    contentThemes: [],
    audienceIntent: null,
    commercialIntent: 50,
    brandSafetyScore: 50,
    commentQuality: 50,
    sponsorshipSignals: [],
    recommendedIndustries: [],
    strengths: [],
    risks: [],
    primaryLanguage: "English",
    creatorInterests: [],
    creatorKeywords: [],
    mentionedBrands: [],
    mentionedProducts: [],
    brandAffinity: [],
    competitorAffinity: [],
    previousCollaborations: [],
    safetyChecks: Object.fromEntries(
      SAFETY_CHECKS.map((key) => [key, { level: "none", note: "" }]),
    ),
    evidence: [],
    ...overrides,
  });

  it("requires every one of the thirteen safety checks", () => {
    // A missing check would render as an absent row rather than an unrated one,
    // and an advertiser reading the panel would take silence for a pass.
    expect(CreatorEnrichment.safeParse(valid()).success).toBe(true);

    const missingOne = valid();
    delete (missingOne.safetyChecks as Record<string, unknown>).hateSpeech;
    expect(CreatorEnrichment.safeParse(missingOne).success).toBe(false);
  });

  it("bounds every score it does accept", () => {
    const base = valid();

    expect(CreatorEnrichment.safeParse(base).success).toBe(true);
    for (const field of ["commercialIntent", "brandSafetyScore", "commentQuality"] as const) {
      expect(CreatorEnrichment.safeParse({ ...base, [field]: 101 }).success).toBe(false);
      expect(CreatorEnrichment.safeParse({ ...base, [field]: -1 }).success).toBe(false);
    }
  });

  it("only accepts categories the platform defines", () => {
    expect(
      CreatorEnrichment.safeParse(valid({ categories: ["crypto-shilling"] })).success,
    ).toBe(false);
  });
});
