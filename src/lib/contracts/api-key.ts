import { z } from "zod";

/* ---------------------------------------------------------------------------
 * API key contracts — DPR §17.2.
 *
 * The shape and the scope catalogue live here rather than beside the
 * repository, because the key-management UI is a client component and must not
 * import anything from `src/server` — doing so drags the session module, and
 * with it `next/headers`, into the browser bundle.
 * ------------------------------------------------------------------------ */

export const ApiScope = z.enum([
  "influencers:read",
  "analytics:read",
  "shortlists:write",
]);
export type ApiScope = z.infer<typeof ApiScope>;

export const API_SCOPES: { id: ApiScope; label: string; detail: string }[] = [
  {
    id: "influencers:read",
    label: "Read influencers",
    detail: "Search and retrieve profiles, social accounts and indexed content.",
  },
  {
    id: "analytics:read",
    label: "Read analytics",
    detail: "Scores, score components, growth history and category benchmarks.",
  },
  {
    id: "shortlists:write",
    label: "Write shortlists",
    detail: "Create shortlists and add creators to them.",
  },
];

/** What a key looks like to a client. The hash never appears in this shape. */
export const ApiKeyView = z.object({
  id: z.string(),
  name: z.string(),
  /** Non-secret. Identifies a key in listings without revealing it. */
  prefix: z.string(),
  createdAt: z.string().datetime(),
  createdByName: z.string(),
  lastUsedAt: z.string().datetime().nullable(),
  revokedAt: z.string().datetime().nullable(),
  scopes: z.array(ApiScope),
  ipAllowlist: z.array(z.string()),
});
export type ApiKeyView = z.infer<typeof ApiKeyView>;

export const CreateApiKeyInput = z.object({
  name: z.string().trim().min(2, "Name the key").max(60),
  scopes: z.array(ApiScope).min(1, "Select at least one scope"),
  ipAllowlist: z.array(z.string().trim()).max(20).optional(),
});
export type CreateApiKeyInput = z.infer<typeof CreateApiKeyInput>;
