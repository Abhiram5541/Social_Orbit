import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { OrgKind, Plan, Role } from "@/lib/contracts/auth";
import { randomBytes } from "node:crypto";
import { ApiFailure, handler, requirePermission } from "@/server/auth/rbac";
import {
  createOrg,
  createUser,
  findOrg,
  issuePasswordToken,
  listUsers,
  setUserPassword,
  setUserStatus,
  type UserRecord,
} from "@/server/repositories/user-repository";
import { sendInviteMail } from "@/server/services/account-mail";

/* ---------------------------------------------------------------------------
 * Platform administration of sign-ins. Super admin only (`admin:users`).
 *
 * Registration on the public site is an enquiry, not an account (see
 * auth/register): every account is created here, by a person who has
 * decided which organisation it belongs to. Without a `password` the person
 * is emailed an invite link and chooses their own; with one, the admin hands
 * it over out of band. POST with `userId` replaces a password; PATCH with
 * `userId` suspends or reinstates.
 * ------------------------------------------------------------------------ */

const CreateUser = z.object({
  email: z.string().trim().email(),
  name: z.string().trim().min(1).max(120),
  role: Role,
  orgId: z.string().trim().min(1).optional(),
  /** Create the organisation in the same call, when it does not exist yet. */
  org: z
    .object({
      name: z.string().trim().min(1).max(120),
      kind: OrgKind,
      plan: Plan,
      /** Their mark, shown in place of the SENSO wordmark in their workspace. */
      logoUrl: z.string().trim().max(500).optional(),
    })
    .optional(),
  password: z.string().min(12).max(200).optional(),
});

/** Never let the hash out, even to an admin — nor the link token's. */
function publicUser(
  user: UserRecord,
): Omit<UserRecord, "passwordHash" | "passwordToken"> & { invitePending: boolean } {
  const { passwordHash: _, passwordToken, ...rest } = user;
  void _;
  return {
    ...rest,
    invitePending:
      passwordToken?.purpose === "invite" && Date.parse(passwordToken.expiresAt) > Date.now(),
  };
}

const SetStatus = z.object({
  userId: z.string().trim().min(1),
  status: z.enum(["active", "suspended"]),
});

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
    const admin = await requirePermission("admin:users");
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
    let user: UserRecord;
    try {
      user = await createUser({
        ...input,
        orgId: target?.id ?? orgId!,
        // An invited person never learns this: the invite token replaces it.
        password: input.password ?? randomBytes(24).toString("base64url"),
      });
    } catch (error) {
      throw new ApiFailure("conflict", (error as Error).message);
    }

    let invited = false;
    if (!input.password) {
      const token = await issuePasswordToken(user.id, "invite");
      const orgRecord = target ?? (await findOrg(user.orgId));
      invited = await sendInviteMail({
        to: user.email,
        name: user.name,
        orgName: orgRecord?.name ?? "SENSO",
        invitedBy: admin.name,
        token,
        origin: request.nextUrl.origin,
      });
      if (!invited) {
        throw new ApiFailure(
          "connector_unavailable",
          "The account was created but the invite could not be emailed (mail is not configured). Set a password for it instead.",
        );
      }
    }
    return NextResponse.json({ ...publicUser(user), invited }, { status: 201 });
  });
}

export async function PATCH(request: NextRequest) {
  return handler(async () => {
    const admin = await requirePermission("admin:users");
    const parsed = SetStatus.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ApiFailure("validation_failed", parsed.error.issues[0].message);
    if (parsed.data.userId === admin.id) {
      throw new ApiFailure("validation_failed", "You cannot suspend your own account.");
    }
    await setUserStatus(parsed.data.userId, parsed.data.status).catch((error: Error) => {
      throw new ApiFailure("not_found", error.message);
    });
    return NextResponse.json({ ok: true });
  });
}
