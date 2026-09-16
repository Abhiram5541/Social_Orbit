import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { OrgKind, Plan, Role } from "@/lib/contracts/auth";
import { ApiFailure, handler, requirePermission } from "@/server/auth/rbac";
import {
  createOrg,
  createUser,
  listUsers,
  setUserPassword,
  type UserRecord,
} from "@/server/repositories/user-repository";

/* ---------------------------------------------------------------------------
 * Platform administration of sign-ins. Super admin only (`admin:users`).
 *
 * Registration on the public site is an enquiry, not an account (see
 * auth/register): every account is created here, by a person who has
 * decided which organisation it belongs to. The password is set by the admin
 * and handed over out of band; POST with `userId` replaces one.
 * ------------------------------------------------------------------------ */

const CreateUser = z.object({
  email: z.string().trim().email(),
  name: z.string().trim().min(1).max(120),
  role: Role,
  orgId: z.string().trim().min(1).optional(),
  /** Create the organisation in the same call, when it does not exist yet. */
  org: z.object({ name: z.string().trim().min(1).max(120), kind: OrgKind, plan: Plan }).optional(),
  password: z.string().min(12).max(200),
});

/** Never let the hash out, even to an admin. */
function publicUser(user: UserRecord): Omit<UserRecord, "passwordHash"> {
  const { passwordHash: _, ...rest } = user;
  void _;
  return rest;
}

const ResetPassword = z.object({
  userId: z.string().trim().min(1),
  password: z.string().min(12).max(200),
});

export async function GET() {
  return handler(async () => {
    await requirePermission("admin:users");
    const users = await listUsers();
    return NextResponse.json(users.map(publicUser));
  });
}

export async function POST(request: NextRequest) {
  // Two response shapes (a reset acknowledgement or the new user), so the
  // handler is widened the way the harvest route's is.
  return handler<unknown>(async () => {
    await requirePermission("admin:users");
    const body: unknown = await request.json().catch(() => null);

    const reset = ResetPassword.safeParse(body);
    if (reset.success) {
      await setUserPassword(reset.data.userId, reset.data.password).catch((error: Error) => {
        throw new ApiFailure("not_found", error.message);
      });
      return NextResponse.json({ ok: true });
    }

    const parsed = CreateUser.safeParse(body);
    if (!parsed.success) {
      throw new ApiFailure("validation_failed", parsed.error.issues[0].message);
    }
    const { org, orgId, ...input } = parsed.data;
    if (!org && !orgId) throw new ApiFailure("validation_failed", "Give an orgId or an org to create.");

    const target = org ? await createOrg(org) : null;
    try {
      const user = await createUser({ ...input, orgId: target?.id ?? orgId! });
      return NextResponse.json(publicUser(user), { status: 201 });
    } catch (error) {
      throw new ApiFailure("conflict", (error as Error).message);
    }
  });
}
