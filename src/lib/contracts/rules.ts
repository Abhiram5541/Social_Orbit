import { z } from "zod";

/* ---------------------------------------------------------------------------
 * Organisation-defined rules: brand-safety policies and custom classifiers.
 *
 * Both are the same mechanism — match terms against a creator's own words —
 * and both are deliberately deterministic. A brand-safety flag is an
 * accusation about a person's work, so it has to be defensible: every flag
 * names the rule that fired, the term that matched and the post it matched
 * in, with a link. A model that says "this seems risky" cannot be argued
 * with; a rule that says "the word X appears in these four uploads" can.
 *
 * Rules are versioned. A creator cleared under v1 of a policy was cleared
 * under v1, and the evidence records which version judged them.
 * ------------------------------------------------------------------------ */

export const RuleKind = z.enum(["brand_safety", "classifier"]);
export type RuleKind = z.infer<typeof RuleKind>;

export const RuleSeverity = z.enum(["block", "review", "note"]);
export type RuleSeverity = z.infer<typeof RuleSeverity>;

export const SEVERITY_LABEL: Record<RuleSeverity, string> = {
  block: "Disqualifying",
  review: "Needs review",
  note: "Worth knowing",
};

/** Where a rule looks. Captions and titles are the creator's own words. */
export const RuleScope = z.enum(["content", "bio", "both"]);
export type RuleScope = z.infer<typeof RuleScope>;

export const Rule = z.object({
  id: z.string(),
  orgId: z.string(),
  kind: RuleKind,
  name: z.string(),
  /** For a classifier: the label applied when the rule matches. */
  label: z.string().nullable(),
  severity: RuleSeverity,
  scope: RuleScope,
  /** Matched as whole words, case-insensitively. */
  terms: z.array(z.string()),
  /** Terms that cancel a match on the same post — "shot" vs "gun shot". */
  exceptions: z.array(z.string()),
  /** How many distinct posts must match before the rule fires. */
  minMatches: z.number().int().min(1),
  enabled: z.boolean(),
  version: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Rule = z.infer<typeof Rule>;

export const RuleInput = z.object({
  kind: RuleKind,
  name: z.string().trim().min(2, "Name the rule").max(80),
  label: z.string().trim().max(40).nullable().default(null),
  severity: RuleSeverity.default("review"),
  scope: RuleScope.default("both"),
  terms: z.array(z.string().trim().min(2).max(40)).min(1, "Add at least one term").max(100),
  exceptions: z.array(z.string().trim().min(2).max(40)).max(100).default([]),
  minMatches: z.number().int().min(1).max(20).default(1),
  enabled: z.boolean().default(true),
});
export type RuleInput = z.infer<typeof RuleInput>;

/** One post that matched, with the words that matched in it. */
export const RuleEvidence = z.object({
  contentId: z.string(),
  url: z.string(),
  publishedAt: z.string(),
  excerpt: z.string(),
  terms: z.array(z.string()),
});
export type RuleEvidence = z.infer<typeof RuleEvidence>;

export const RuleHit = z.object({
  ruleId: z.string(),
  ruleName: z.string(),
  kind: RuleKind,
  label: z.string().nullable(),
  severity: RuleSeverity,
  matches: z.number().int(),
  /** Up to five posts, newest first — enough to check, not a dump. */
  evidence: z.array(RuleEvidence),
  ruleVersion: z.number().int(),
});
export type RuleHit = z.infer<typeof RuleHit>;

export const CreatorRuleReport = z.object({
  influencerId: z.string(),
  /** Rules that fired, worst first. */
  hits: z.array(RuleHit),
  /** Labels applied by classifier rules. */
  labels: z.array(z.string()),
  /** Posts read to produce this, so coverage is visible. */
  postsScanned: z.number().int(),
  bioScanned: z.boolean(),
  verdict: z.enum(["clear", "note", "review", "block", "no_rules"]),
  evaluatedAt: z.string().datetime(),
  engineVersion: z.string(),
});
export type CreatorRuleReport = z.infer<typeof CreatorRuleReport>;
