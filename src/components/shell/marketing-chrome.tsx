import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/class-names";
import { Wordmark } from "@/components/shell/logo";
import { LinkButton } from "@/components/ui/button";

/*
 * The homepage is written for marketers, agencies and the people who sign the
 * budget. Developer API moved onto /pricing, beside the plan that includes it,
 * because a nav slot spent on integrators is a slot the buyer does not use.
 */
const NAV = [
  { href: "/#discover", label: "Discover" },
  { href: "/#evaluate", label: "Evaluate" },
  { href: "/#activate", label: "Campaigns" },
  { href: "/pricing", label: "Pricing" },
];

/**
 * Shared chrome for the marketing pages. Sign-in pages opt out of it.
 *
 * `onDark` is for a page that opens on the graphite hero: the header then
 * belongs to that surface rather than sitting on top of it as a white bar, and
 * it acquires its own ground only once the reader has scrolled past the hero.
 */
export function MarketingChrome({
  children,
  onDark = false,
}: {
  children: React.ReactNode;
  onDark?: boolean;
}) {
  return (
    <div className={cn("flex min-h-dvh flex-col", onDark && "bg-instrument")}>
      <a
        href="#main"
        className="sr-only-focusable absolute left-3 top-3 z-50 rounded-md bg-brand px-3 py-2 text-base font-semibold text-white"
      >
        Skip to content
      </a>

      <header
        className={cn(
          "sticky top-0 z-30",
          onDark
            ? "bg-instrument/85 backdrop-blur-md"
            : "border-b border-line bg-surface/85 backdrop-blur-md",
        )}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-7 px-4 sm:px-6">
          <Link href="/" className="rounded" aria-label="SocialOrbit home">
            <Wordmark inverse={onDark} />
          </Link>
          <nav aria-label="Main" className="hidden md:block">
            <ul className="flex items-center gap-1">
              {NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "press rounded-md px-2.5 py-1.5 text-base font-medium",
                      onDark
                        ? "text-instrument-muted hover:bg-instrument-raised hover:text-instrument-ink"
                        : "text-ink-muted hover:bg-sunken hover:text-ink",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/login"
              className={cn(
                "press rounded-md px-2.5 py-1.5 text-base font-semibold",
                onDark
                  ? "text-instrument-muted hover:bg-instrument-raised hover:text-instrument-ink"
                  : "text-ink-muted hover:bg-sunken hover:text-ink",
              )}
            >
              Sign in
            </Link>
            <LinkButton
              href="/register"
              variant={onDark ? "accent" : "primary"}
              size="sm"
              className="gap-1.5"
            >
              Request a demo
              <ArrowUpRight className="size-3.5" aria-hidden />
            </LinkButton>
          </div>
        </div>
      </header>

      <main id="main" className="flex-1">
        {children}
      </main>

      {/* The footer closes the page back into the housing the hero opened
          with, so the whole site sits between two graphite edges. */}
      <footer className="bg-instrument text-instrument-ink">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <Wordmark inverse />
            <p className="max-w-xs text-sm text-instrument-muted">
              Influencer intelligence built on official platform APIs, authorized creator
              connections and permitted public research.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-10 gap-y-4 text-base sm:grid-cols-3">
            <FooterGroup
              title="Platform"
              links={[
                { href: "/#discover", label: "Discovery" },
                { href: "/#verify", label: "Data provenance" },
                { href: "/#intelligence", label: "AI intelligence" },
                { href: "/pricing#api", label: "Developer API" },
              ]}
            />
            <FooterGroup
              title="Company"
              links={[
                { href: "/pricing", label: "Pricing" },
                { href: "/login", label: "Sign in" },
                { href: "/register", label: "Request a demo" },
              ]}
            />
          </div>
        </div>
        <div className="border-t border-instrument-line">
          <p className="mx-auto max-w-6xl px-4 py-4 text-sm text-instrument-subtle sm:px-6">
            © {new Date().getFullYear()} SocialOrbit. Data is collected from official platform
            APIs and authorized connections. Estimated and AI-inferred values are labelled as
            such throughout the product. Creators shown in marketing interfaces are
            illustrative; coverage figures are read live from the database.
          </p>
        </div>
      </footer>
    </div>
  );
}

function FooterGroup({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div className="space-y-2.5">
      <p className="label-caps-sm text-instrument-subtle">{title}</p>
      <ul className="space-y-2">
        {links.map((link) => (
          <li key={link.href + link.label}>
            <Link
              href={link.href}
              className="rounded text-instrument-muted hover:text-instrument-ink hover:underline"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
