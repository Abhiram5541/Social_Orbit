import { shared } from "@/server/data/process-store";

/* Correction requests, development driver. Anchored on globalThis (D7) so the
 * submit action and the next page render see the same rows. A corrections
 * repository owns this shape when persistence lands — this file moves behind
 * it, not into a component. */

export const CORRECTION_FIELD_LABEL = {
  identity: "Name, handle or profile image",
  category: "Category or niche",
  country: "Country or language",
  account: "A linked social account is not mine",
  metrics: "A metric looks wrong",
  ai: "An AI classification is inaccurate",
  other: "Something else",
} as const;

export type CorrectionField = keyof typeof CORRECTION_FIELD_LABEL;

export interface CorrectionRecord {
  id: string;
  profileId: string;
  field: CorrectionField;
  detail: string;
  /** Set at submit time — a real event anchor, not a render-minted one. */
  raisedAt: string;
  status: "open";
}

export function correctionStore(): CorrectionRecord[] {
  return shared<CorrectionRecord[]>("creator-corrections", () => []);
}
