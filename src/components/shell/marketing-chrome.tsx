import Link from "next/link";
import { Wordmark } from "@/components/shell/logo";
import { LinkButton } from "@/components/ui/button";

const NAV = [
  { href: "/#platform", label: "Platform" },
  { href: "/#intelligence", label: "Intelligence" },
  { href: "/#api", label: "Developer API" },
  { href: "/pricing", label: "Pricing" },
];

/** Shared chrome for the marketing pages. Sign-in pages opt out of it. */
export function MarketingChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only-focusable absolute left-3 top-3 z-50 rounded-lg bg-brand px-3 py-2 text-[13px] font-medium text-white"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link href="/" className="rounded" aria-label="SocialOrbit home">
            <Wordmark />
          </Link>
          <nav aria-label="Main" className="hidden md:block">
            <ul className="flex items-center gap-1">
              {NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-ink-muted transition-colors hover:bg-sunken hover:text-ink"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <LinkButton href="/login" variant="ghost" size="sm">
              Sign in
            </LinkButton>
            <LinkButton href="/register" variant="primary" size="sm">
              Request access
            </LinkButton>
          </div>
        </div>
      </header>

      <main id="main" className="flex-1">
        {children}
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <Wordmark />
            <p className="max-w-xs text-[12px] text-ink-muted">
              Influencer intelligence built on official platform APIs, authorized creator
              connections and permitted public research.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-10 gap-y-4 text-[13px] sm:grid-cols-3">
            <FooterGroup
              title="Platform"
              links={[
                { href: "/#intelligence", label: "Intelligence" },
                { href: "/#verification", label: "Verification" },
                { href: "/#api", label: "Developer API" },
              ]}
            />
            <FooterGroup
              title="Company"
              links={[
                { href: "/pricing", label: "Pricing" },
                { href: "/login", label: "Sign in" },
                { href: "/register", label: "Request access" },
              ]}
            />
          </div>
        </div>
        <div className="border-t border-line">
          <p className="mx-auto max-w-6xl px-4 py-3 text-[12px] text-ink-subtle sm:px-6">
            © {new Date().getFullYear()} SocialOrbit. Data is collected from official platform
            APIs and authorized connections. Estimated and AI-inferred values are labelled as
            such throughout the product.
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
    <div className="space-y-2">
      <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-ink-subtle">
        {title}
      </p>
      <ul className="space-y-1.5">
        {links.map((link) => (
          <li key={link.href + link.label}>
            <Link href={link.href} className="rounded text-ink-muted hover:text-ink hover:underline">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
