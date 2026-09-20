import Link from "next/link";
import { Wordmark } from "@/components/shell/logo";
import { LinkButton } from "@/components/ui/button";

/** The one 404 for every route group: a page, a profile id, a typo. */
export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <Link href="/" aria-label="SENSO home">
        <Wordmark />
      </Link>
      <div className="space-y-2">
        <p className="font-num text-sm text-ink-subtle">404</p>
        <h1 className="text-title font-semibold tracking-display text-ink">Page not found</h1>
        <p className="max-w-sm text-base text-ink-muted">
          Nothing lives at this address. If it was a creator, the profile may have been removed
          from the index.
        </p>
      </div>
      <LinkButton href="/" variant="primary">
        Back to SENSO
      </LinkButton>
    </main>
  );
}
