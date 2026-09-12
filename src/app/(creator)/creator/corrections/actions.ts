"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOwnProfile } from "@/server/auth/creator";
import { CORRECTION_FIELD_LABEL, correctionStore, type CorrectionField } from "./store";

const CorrectionInput = z.object({
  field: z.enum(
    Object.keys(CORRECTION_FIELD_LABEL) as [CorrectionField, ...CorrectionField[]],
  ),
  detail: z.string().trim().min(1).max(2000),
});

export async function submitCorrection(formData: FormData): Promise<void> {
  const { profile } = await requireOwnProfile("/creator/corrections");

  const parsed = CorrectionInput.safeParse({
    field: formData.get("field"),
    detail: formData.get("detail"),
  });
  if (!parsed.success) redirect("/creator/corrections?submitted=invalid");

  correctionStore().push({
    id: crypto.randomUUID(),
    profileId: profile.id,
    field: parsed.data.field,
    detail: parsed.data.detail,
    raisedAt: new Date().toISOString(),
    status: "open",
  });

  redirect("/creator/corrections?submitted=1");
}
