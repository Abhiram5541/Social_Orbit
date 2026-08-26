import type { Metadata } from "next";
import { ClipboardList } from "lucide-react";
import { requireOwnProfile } from "@/server/auth/creator";
import { PageBody, PageHeader } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Select, Textarea } from "@/components/ui/field";
import { EmptyState, Notice } from "@/components/ui/states";

export const metadata: Metadata = { title: "Corrections" };
export const dynamic = "force-dynamic";

export default async function CorrectionsPage() {
  const { profile } = await requireOwnProfile("/creator/corrections");

  return (
    <>
      <PageHeader
        title="Correction requests"
        description="Tell us when something on your profile is wrong. A reviewer checks the source rather than editing the number directly."
      />
      <PageBody className="space-y-4">
        <Notice tone="info" title="Why corrections go through review">
          Every figure on your profile is traceable to a source and a collection time. Editing
          a number without correcting its source would break that chain and quietly make the
          record less trustworthy. A reviewer re-checks the source and, if it was wrong, the
          data is re-ingested — DPR UC-11.
        </Notice>

        <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <Card>
            <CardHeader>
              <CardTitle>Raise a request</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4">
                <Field label="What is wrong?" required>
                  <Select name="field" defaultValue="">
                    <option value="" disabled>
                      Select a field
                    </option>
                    <option value="identity">Name, handle or profile image</option>
                    <option value="category">Category or niche</option>
                    <option value="country">Country or language</option>
                    <option value="account">A linked social account is not mine</option>
                    <option value="metrics">A metric looks wrong</option>
                    <option value="ai">An AI classification is inaccurate</option>
                    <option value="other">Something else</option>
                  </Select>
                </Field>
                <Field
                  label="Details"
                  required
                  hint="What the record says, what it should say, and where we can verify it."
                >
                  <Textarea name="detail" rows={5} />
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
            <EmptyState
              icon={ClipboardList}
              title="No open requests"
              description={`Nothing has been raised against ${profile.displayName}. Requests appear here with their status until a reviewer resolves them.`}
            />
          </Card>
        </div>
      </PageBody>
    </>
  );
}
