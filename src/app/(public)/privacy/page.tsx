import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/shell/legal-page";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Privacy"
      summary="What SocialOrbit collects, where it comes from, how long it is kept, and how a creator can correct or remove it."
      updated="27 August 2026"
      sections={[
        {
          heading: "What is collected, and from where",
          body: (
            <>
              <p>
                Creator records are built from four kinds of source, in this order of
                authority: official platform APIs; accounts a creator has connected through
                OAuth; approved data providers; and permitted public web content. Every stored
                fact keeps its source, the time it was collected, and a confidence value.
              </p>
              <p>
                SocialOrbit does not scrape private or platform-protected information, and does
                not use AI providers as a route to data a platform has not made available.
              </p>
            </>
          ),
        },
        {
          heading: "Connected accounts",
          body: (
            <>
              <p>
                When a creator connects an account, SocialOrbit requests the narrowest scopes
                that allow it to read that creator&apos;s own statistics. Access tokens are
                encrypted at rest and are never sent to a browser.
              </p>
              <p>
                Audience demographics come only from connected professional accounts. They are
                visible to the creator and to SocialOrbit reviewers — never to clients browsing
                a public profile, and never through the API.
              </p>
            </>
          ),
        },
        {
          heading: "Correction and removal",
          body: (
            <>
              <p>
                A creator can raise a correction request from their portal. A reviewer checks
                the underlying source rather than editing the number directly, because editing
                a value without correcting its source breaks the record&apos;s traceability.
              </p>
              <p>
                Creators may request removal of their profile. Disconnecting an account stops
                authorized analytics refreshing immediately.{" "}
                <Link href="/help/verification" className="rounded font-medium text-brand-ink underline underline-offset-2">
                  How verification works
                </Link>
              </p>
            </>
          ),
        },
        {
          heading: "Retention",
          body: (
            <p>
              Historical snapshots are retained because the product&apos;s value depends on
              them — growth, consistency and anomaly detection are all comparisons against a
              creator&apos;s own past. Raw research artifacts and comment text are retained only
              as long as needed to produce the derived signals, then discarded.
            </p>
          ),
        },
      ]}
    />
  );
}
