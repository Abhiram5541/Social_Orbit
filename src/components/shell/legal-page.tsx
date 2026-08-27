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
        <h1 className="mt-2 text-[32px] font-bold leading-[1.1] tracking-[-0.03em] text-ink">
          {title}
        </h1>
        <p className="mt-3 text-[15px] leading-6 text-ink-muted">{summary}</p>
        <p className="mt-2 text-[12px] text-ink-subtle">Last updated {updated}</p>

        <div className="mt-10 space-y-8">
          {sections.map((section) => (
            <section key={section.heading} className="border-t border-line pt-6">
              <h2 className="text-[17px] font-bold tracking-[-0.02em] text-ink">
                {section.heading}
              </h2>
              <div className="mt-2 space-y-3 text-[14px] leading-6 text-ink-muted">
                {section.body}
              </div>
            </section>
          ))}
        </div>
      </article>
    </MarketingChrome>
  );
}
