import type { Metadata } from "next";
import { ClipboardList } from "lucide-react";
import { formatRelativeTime } from "@/lib/format";
import { requireOwnProfile } from "@/server/auth/creator";
import { PageBody, PageHeader } from "@/components/shell/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Select, Textarea } from "@/components/ui/field";
import { EmptyState, Notice } from "@/components/ui/states";
import { submitCorrection } from "./actions";
import { CORRECTION_FIELD_LABEL, correctionStore } from "./store";

export const metadata: Metadata = { title: "Corrections" };
export const dynamic = "force-dynamic";

export default async function CorrectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>;
}) {
  const { profile } = await requireOwnProfile("/creator/corrections");
  const outcome = await searchParams;

  // Newest first — filter already copies, so reversing in place is safe.
  const requests = correctionStore()
    .filter((request) => request.profileId === profile.id)
    .reverse();

  return (
    <>
      <PageHeader
        eyebrow="Performance"
        title="Correction requests"
        description="Tell us when something on your profile is wrong. A reviewer checks the source rather than editing the number directly."
      />
      <PageBody className="space-y-4">
        {outcome.submitted === "1" && (
          <Notice tone="positive" title="Request received">
            A reviewer will re-check the source. The request appears below with its status
            until it is resolved.
          </Notice>
        )}
        {outcome.submitted === "invalid" && (
          <Notice tone="caution" title="Nothing was recorded">
            Select a field and describe what is wrong before submitting.
          </Notice>
        )}

        <Notice tone="info" title="Why corrections go through review">
          Every figure on your profile is traceable to a source and a collection time. Editing
          a number without correcting its source would break that chain and quietly make the
          record less trustworthy. A reviewer re-checks the source and, if it was wrong, the
          data is re-ingested from its source.
        </Notice>

        <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <Card>
            <CardHeader>
              <CardTitle>Raise a request</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={submitCorrection} className="space-y-4">
                <Field label="What is wrong?" required>
                  <Select name="field" defaultValue="" required>
                    <option value="" disabled>
                      Select a field
                    </option>
                    {Object.entries(CORRECTION_FIELD_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field
                  label="Details"
                  required
                  hint="What the record says, what it should say, and where we can verify it."
                >
                  <Textarea name="detail" rows={5} required />
                </Field>
                <Button type="submit" variant="primary">
                  Submit request
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your requests</CardTitle>
            </CardHeader>
            {requests.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title="No open requests"
                description="No open requests on your record. When you raise one it appears here with its review status until a reviewer resolves it."
              />
            ) : (
              <ul className="divide-y divide-line">
                {requests.map((request) => (
                  <li key={request.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-ink">
                        {CORRECTION_FIELD_LABEL[request.field]}
                      </span>
                      <span className="block text-base text-ink-muted">{request.detail}</span>
                      <span className="mt-1 block text-sm text-ink-muted">
                        Raised {formatRelativeTime(request.raisedAt)}
                      </span>
                    </span>
                    <Badge tone="neutral" dot>
                      Open
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </PageBody>
    </>
  );
}
