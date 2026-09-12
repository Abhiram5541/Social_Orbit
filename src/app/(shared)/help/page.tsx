import type { Metadata } from "next";
import Link from "next/link";
import { requirePageSession } from "@/server/auth/rbac";
import { PageBody, PageHeader } from "@/components/shell/app-shell";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Help" };
export const dynamic = "force-dynamic";

/* Two groups, one reading column — the same composition as the verification
   page beside it. The first group explains how the numbers are made; the
   second covers the operational rules of using them. */

const SCORING_TOPICS = [
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
];

const OPERATIONAL_TOPICS = [
  {
    title: "What counts against my search allowance",
    body: "Applying a keyword or a filter counts as one search. Paging through results you already have, re-sorting them, opening a profile, and viewing shortlists or campaigns are all free. The count is kept server-side per organisation and resets each calendar month.",
  },
  {
    title: "Why some audience data is unavailable",
    body: "Demographics require the creator to connect a professional account and authorise access. SocialOrbit does not estimate demographics from public data, because there is no defensible way to do it. An unavailable breakdown is stated as unavailable rather than filled in.",
  },
  {
    title: "How verification is granted",
    body: "Only after a creator completes OAuth consent and the connected platform identity matches the claimed profile. It is never issued from public data collection, and it cannot be requested by a client on a creator's behalf.",
    href: "/help/verification",
    hrefLabel: "How verification works, step by step",
  },
];

function TopicList({
  topics,
}: {
  topics: { title: string; body: string; href?: string; hrefLabel?: string }[];
}) {
  return (
    <div className="divide-y divide-line">
      {topics.map((topic) => (
        <div key={topic.title} className="px-4 py-3">
          <h3 className="font-semibold text-ink">{topic.title}</h3>
          <p className="mt-1 text-base leading-6 text-ink-muted">{topic.body}</p>
          {topic.href && (
            <p className="mt-1.5 text-base">
              <Link
                href={topic.href}
                className="rounded font-medium text-brand-ink underline underline-offset-2"
              >
                {topic.hrefLabel}
              </Link>
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

export default async function HelpPage() {
  await requirePageSession("/help");

  return (
    <>
      <PageHeader
        title="Help"
        description="How SocialOrbit's numbers are produced, and what they do and do not claim."
      />
      <PageBody className="max-w-3xl space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>How the numbers are made</CardTitle>
          </CardHeader>
          <TopicList topics={SCORING_TOPICS} />
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Using the platform</CardTitle>
          </CardHeader>
          <TopicList topics={OPERATIONAL_TOPICS} />
        </Card>

        <p className="text-base text-ink-muted">
          Developer documentation lives in the{" "}
          <Link
            href="/api-portal"
            className="rounded font-medium text-brand-ink underline underline-offset-2"
          >
            API portal
          </Link>
          . For anything else, contact your account manager.
        </p>
      </PageBody>
    </>
  );
}
