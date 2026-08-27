import type { Metadata } from "next";
import Link from "next/link";
import { requirePageSession } from "@/server/auth/rbac";
import { PageBody, PageHeader } from "@/components/shell/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Help" };
export const dynamic = "force-dynamic";

const TOPICS = [
  {
    title: "How the health score works",
    body: "Nine weighted components — authenticity, engagement quality, engagement rate, growth pattern, view consistency, audience activity, comment quality, upload consistency and brand safety — combined by a published formula in backend code. Components that cannot be measured are excluded and the remaining weights renormalise, so a creator is never penalised for a metric their platform does not expose.",
  },
  {
    title: "Why confidence is shown separately",
    body: "Quality and certainty are different questions. A creator can score 91 on health with 40% confidence when their profile is new or thinly observed. Folding the two together would hide exactly the case where you should be most careful.",
  },
  {
    title: "What the provenance marks mean",
    body: "Verified means confirmed through the creator's own authorised connection. Observed means measured through an official platform API. Derived means calculated by SocialOrbit from observed values. Estimated means modelled — treat it as a range. AI inferred means classified by a model from source material, never a platform measurement.",
  },
  {
    title: "Why some audience data is unavailable",
    body: "Demographics require the creator to connect a professional account and authorise access. SocialOrbit does not estimate demographics from public data, because there is no defensible way to do it. An unavailable breakdown is stated as unavailable rather than filled in.",
  },
  {
    title: "What counts against my search allowance",
    body: "Applying a keyword or a filter counts as one search. Paging through results you already have, re-sorting them, opening a profile, and viewing shortlists or campaigns are all free. The count is kept server-side per organisation and resets each calendar month.",
  },
  {
    title: "How verification is granted",
    body: "Only after a creator completes OAuth consent and the connected platform identity matches the claimed profile. It is never issued from public data collection, and it cannot be requested by a client on a creator's behalf.",
  },
];

export default async function HelpPage() {
  await requirePageSession("/help");

  return (
    <>
      <PageHeader
        title="Help"
        description="How SocialOrbit's numbers are produced, and what they do and do not claim."
      />
      <PageBody className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          {TOPICS.map((topic) => (
            <Card key={topic.title}>
              <CardHeader>
                <CardTitle>{topic.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-[13px] leading-5 text-ink-muted">{topic.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Still stuck?</CardTitle>
          </CardHeader>
          <CardContent className="text-[13px] text-ink-muted">
            Developer documentation lives in the{" "}
            <Link href="/api-portal" className="rounded font-medium text-brand-ink underline underline-offset-2">
              API portal
            </Link>
            . For anything else, contact your account manager.
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
