import type { Metadata } from "next";
import { readUnsubscribeToken } from "@/server/services/outreach-service";
import { UnsubscribeForm } from "@/components/crm/unsubscribe-form";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * The recipient's own way out. A GET only *offers* to unsubscribe — mail
 * scanners and link previewers fetch every URL in a message, and a one-click
 * GET would opt people out who never touched the link.
 */
export default async function UnsubscribePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const valid = readUnsubscribeToken(token) !== null;

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-extrabold text-ink">Stop receiving these emails</h1>
      {valid ? (
        <>
          <p className="mt-3 text-base text-ink-muted">
            You will be removed from this brand&rsquo;s outreach list. It takes effect
            immediately and applies to every future message from them, including campaign
            invitations.
          </p>
          <UnsubscribeForm token={token} />
          <p className="mt-6 text-sm text-ink-subtle">
            This does not delete your profile. SENSO indexes creators from public platform
            APIs; this controls whether this brand may email you.
          </p>
        </>
      ) : (
        <p className="mt-3 text-base text-ink-muted">
          This link is not valid. It may have been altered in transit — copy it from the
          email again, or reply to the sender asking them to stop.
        </p>
      )}
    </main>
  );
}
