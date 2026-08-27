import type { Metadata } from "next";
import { LegalPage } from "@/components/shell/legal-page";

export const metadata: Metadata = { title: "Terms of service" };

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Terms of service"
      summary="What SocialOrbit provides, what it does not claim, and what you agree to when you use it."
      updated="27 August 2026"
      sections={[
        {
          heading: "What the service is",
          body: (
            <>
              <p>
                SocialOrbit provides influencer intelligence: creator records assembled from
                official platform APIs, from accounts creators have connected themselves, and
                from permitted public research, together with analytics and scores calculated
                from those records.
              </p>
              <p>
                Access is granted per organisation under a plan. Your plan sets how many
                searches you may run, how many seats you may use, and whether you may query
                the API.
              </p>
            </>
          ),
        },
        {
          heading: "What the numbers mean",
          body: (
            <>
              <p>
                Every figure carries its provenance. Values marked estimated or AI-inferred are
                interpretations, not measurements, and must not be presented to third parties
                as measured facts.
              </p>
              <p>
                Scores are produced by published, versioned formulas over stored observations.
                They are decision support. They are not a warranty of a creator&apos;s future
                performance, and no score should be the sole basis of a commercial decision.
              </p>
            </>
          ),
        },
        {
          heading: "Acceptable use",
          body: (
            <>
              <p>
                Do not attempt to re-identify individuals beyond what a creator has made
                public, resell bulk extracts of the database, or use the service to harass any
                person or organisation.
              </p>
              <p>
                API keys are issued to your organisation and must not be shared outside it. You
                are responsible for activity performed with your keys; rotate or revoke them
                from the API portal if one is exposed.
              </p>
            </>
          ),
        },
        {
          heading: "Availability and change",
          body: (
            <p>
              Platform APIs change, and connectors can be suspended by the platforms that
              provide them. Where a source becomes unavailable, affected profiles are marked
              stale rather than quietly served as current.
            </p>
          ),
        },
      ]}
    />
  );
}
