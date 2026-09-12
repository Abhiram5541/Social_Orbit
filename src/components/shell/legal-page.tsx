import * as React from "react";
import { MarketingChrome } from "@/components/shell/marketing-chrome";
import { Eyebrow } from "@/components/ui/card";

export interface LegalSection {
  heading: string;
  body: React.ReactNode;
}

/**
 * Shared shell for the policy pages. They are short and factual on purpose:
 * this product's whole argument is that it says where data comes from, so its
 * own policies should be readable rather than defensive.
 */
export function LegalPage({
  eyebrow,
  title,
  summary,
  updated,
  sections,
}: {
  eyebrow: string;
  title: string;
  summary: string;
  updated: string;
  sections: LegalSection[];
}) {
  return (
    <MarketingChrome>
      <article className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="display-lg mt-2 text-ink">{title}</h1>
        <p className="mt-3 text-md leading-6 text-ink-muted">{summary}</p>
        <p className="mt-2 text-sm text-ink-subtle">Last updated {updated}</p>

        <div className="mt-10 space-y-8">
          {sections.map((section) => (
            <section key={section.heading} className="border-t border-line pt-6">
              <h2 className="text-md font-bold text-ink">{section.heading}</h2>
              <div className="mt-2 space-y-3 leading-6 text-ink-muted">
                {section.body}
              </div>
            </section>
          ))}
        </div>
      </article>
    </MarketingChrome>
  );
}
