"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Image as ImageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, Notice } from "@/components/ui/states";

/* What the creator's thumbnails show. Every safety flag links the thumbnail
 * it came from, because a visual claim nobody can check is not evidence. */

interface VisualRecord {
  influencerId: string;
  thumbnailsRead: number;
  styles: { style: string; count: number }[];
  facesShare: number | null;
  textShare: number | null;
  subjects: { subject: string; count: number }[];
  palette: { colour: string; count: number }[];
  safetyFlags: { concern: string; contentId: string; url: string; thumbnailUrl: string }[];
  consistency: number | null;
  model: string;
  promptVersion: string;
}

const STYLE_LABEL: Record<string, string> = {
  person_to_camera: "Person to camera",
  product_close_up: "Product close-up",
  text_overlay: "Heavy text overlay",
  scenery: "Scenery or location",
  gameplay_or_screen: "Gameplay or screen",
  graphic_or_illustration: "Graphic or illustration",
  other: "Other",
};

export function VisualPanel({
  record,
  blocked,
  influencerId,
  canRun,
}: {
  record: VisualRecord | null;
  blocked: string | null;
  influencerId: string;
  canRun: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/internal/visual", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ influencerId }),
    }).catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      const body = (await response?.json().catch(() => null)) as { error?: { message?: string } } | null;
      setError(body?.error?.message ?? "Could not read the thumbnails.");
      return;
    }
    router.refresh();
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between gap-3">
        <CardTitle>What the thumbnails show</CardTitle>
        {canRun && !blocked && (
          <Button size="sm" variant="secondary" onClick={run} disabled={busy}>
            {busy ? "Reading…" : record ? "Read again" : "Read the thumbnails"}
          </Button>
        )}
      </CardHeader>

      {blocked && (
        <CardContent>
          <Notice tone="info" title="Not measured">
            {blocked}
          </Notice>
        </CardContent>
      )}

      {error && (
        <CardContent>
          <Notice tone="critical" title="Not read">
            {error}
          </Notice>
        </CardContent>
      )}

      {!record && !blocked && (
        <EmptyState
          icon={ImageIcon}
          title="No reading yet"
          description="Describes each recent thumbnail — what it shows, whether a face or heavy text is in it, its colours, and anything a brand would want to see before appearing beside it."
        />
      )}

      {record && (
        <>
          <div className="grid gap-px bg-rule sm:grid-cols-3">
            <div className="bg-surface px-4 py-3">
              <p className="text-sm text-ink-muted">Shows a face</p>
              <p className="font-num text-3xl text-ink">
                {record.facesShare === null ? "—" : `${record.facesShare}%`}
              </p>
            </div>
            <div className="bg-surface px-4 py-3">
              <p className="text-sm text-ink-muted">Heavy text</p>
              <p className="font-num text-3xl text-ink">
                {record.textShare === null ? "—" : `${record.textShare}%`}
              </p>
            </div>
            <div className="bg-surface px-4 py-3">
              <p className="text-sm text-ink-muted">Style consistency</p>
              <p className="font-num text-3xl text-ink">
                {record.consistency === null ? "—" : `${record.consistency}%`}
              </p>
              <p className="text-sm text-ink-subtle">
                in {STYLE_LABEL[record.styles[0]?.style] ?? "one style"}
              </p>
            </div>
          </div>

          <div className="border-t border-line px-4 py-3">
            <p className="label-caps text-ink-subtle">Recurring subjects</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {record.subjects.map((subject) => (
                <Badge key={subject.subject} tone="neutral">
                  {subject.subject} · {subject.count}
                </Badge>
              ))}
              {record.subjects.length === 0 && (
                <span className="text-sm text-ink-subtle">Nothing repeated often enough to name.</span>
              )}
            </div>
          </div>

          {record.palette.length > 0 && (
            <div className="border-t border-line px-4 py-3">
              <p className="label-caps text-ink-subtle">Palette</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {record.palette.map((colour) => (
                  <Badge key={colour.colour} tone="neutral">
                    {colour.colour}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {record.safetyFlags.length > 0 && (
            <div className="border-t border-line px-4 py-3">
              <p className="label-caps text-ink-subtle">Seen in a thumbnail</p>
              <ul className="mt-2 space-y-2">
                {record.safetyFlags.map((flag) => (
                  <li key={flag.contentId} className="flex items-center gap-3">
                    <Badge tone="caution">{flag.concern}</Badge>
                    <a
                      href={flag.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-medium text-brand hover:underline"
                    >
                      Open the post and look
                    </a>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-sm text-ink-subtle">
                Evidence, not a verdict: each flag names the thumbnail it came from so you can
                see the same picture and decide for yourself.
              </p>
            </div>
          )}

          <CardContent className="border-t border-line">
            <p className="text-sm text-ink-subtle">
              {record.thumbnailsRead} recent thumbnails, described one at a time by{" "}
              {record.model} (prompt {record.promptVersion}); the shares above are arithmetic
              over those descriptions. Images are read from the platform by link — SENSO does
              not store a creator&rsquo;s artwork.
            </p>
          </CardContent>
        </>
      )}
    </Card>
  );
}
