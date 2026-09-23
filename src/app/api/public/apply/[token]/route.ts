import { NextResponse, type NextRequest } from "next/server";
import { ApplicationPatch } from "@/lib/contracts/onboarding";
import { errorResponse, handler } from "@/server/auth/rbac";
import { applicationByToken, patchApplication } from "@/server/services/onboarding-service";

type Params = { params: Promise<{ token: string }> };

const strip = (application: NonNullable<ReturnType<typeof applicationByToken>>) => {
  const { token: _t, ...rest } = application;
  void _t;
  return rest;
};

export async function GET(_request: NextRequest, { params }: Params) {
  return handler(async () => {
    const { token } = await params;
    const application = applicationByToken(token);
    if (!application) return errorResponse("not_found", "This application link is not valid.");
    return NextResponse.json(strip(application));
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  return handler(async () => {
    const { token } = await params;
    const parsed = ApplicationPatch.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return errorResponse("validation_failed", parsed.error.issues[0].message);

    const application = patchApplication(token, parsed.data);
    if (!application) {
      return errorResponse("conflict", "This application is closed or the link is not valid.");
    }
    return NextResponse.json(strip(application));
  });
}
