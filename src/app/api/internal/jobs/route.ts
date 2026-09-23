import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ApiFailure, handler, requirePermission } from "@/server/auth/rbac";
import { drain, listJobs, retryJob } from "@/server/services/job-queue";

/** Operator view of the queue, including the dead-letter shelf. */
export async function GET(request: NextRequest) {
  return handler(async () => {
    await requirePermission("admin:system_health");
    const status = request.nextUrl.searchParams.get("status");
    return NextResponse.json({
      items: listJobs(status ? { status: status as never } : {}).slice(0, 200),
    });
  });
}

const Body = z.object({ action: z.enum(["retry", "drain"]), jobId: z.string().optional() });

export async function POST(request: NextRequest) {
  // Two shapes — a drain report or the retried job — so the handler is
  // widened, as the admin users route does.
  return handler<unknown>(async () => {
    await requirePermission("admin:system_health");
    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ApiFailure("validation_failed", parsed.error.issues[0].message);

    if (parsed.data.action === "drain") return NextResponse.json(await drain(5_000));
    if (!parsed.data.jobId) throw new ApiFailure("validation_failed", "Name the job.");
    const job = retryJob(parsed.data.jobId);
    if (!job) throw new ApiFailure("conflict", "Only a dead job can be retried.");
    return NextResponse.json(job);
  });
}
