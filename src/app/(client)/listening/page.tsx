import type { Metadata } from "next";
import { requirePagePermission } from "@/server/auth/rbac";
import { PageBody, PageHeader } from "@/components/shell/app-shell";
import { Notice } from "@/components/ui/states";
import { ListeningView } from "@/components/listening/listening-view";

export const metadata: Metadata = { title: "Listening" };
export const dynamic = "force-dynamic";

export default async function ListeningPage() {
  await requirePagePermission("influencer:read", "/listening");

  return (
    <>
      <PageHeader
        title="Listening"
        description="Track a brand, a product or a theme across every post SENSO has indexed — who is talking about it, how often, with what reach, and which tags travel with it."
      />
      <PageBody className="space-y-4">
        <Notice tone="info" title="This listens to creators, not to consumers">
          SENSO indexes creator posts through official platform APIs. It holds no consumer
          posts, reviews or forum threads, and no public API offers them — so every reading
          here states how many creators and posts it searched. Consumer-side listening needs
          a licensed source, and calling this that would be the kind of number a client
          would eventually quote in a board meeting.
        </Notice>
        <ListeningView />
      </PageBody>
    </>
  );
}
