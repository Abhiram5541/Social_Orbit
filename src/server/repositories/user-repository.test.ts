import { describe, expect, it } from "vitest";
import {
  authenticate,
  findUserByEmail,
  issuePasswordToken,
  redeemPasswordToken,
} from "./user-repository";

// Development driver: the seed accounts, hashed with the fallback password.
const EMAIL = "hello@lumen.example";

describe("emailed password links", () => {
  it("sets the password once and spends the token", async () => {
    const user = (await findUserByEmail(EMAIL))!;
    const token = await issuePasswordToken(user.id, "reset");

    expect(await redeemPasswordToken("not-the-token-at-all-000000", "Fresh-Password-1")).toBeNull();
    expect((await redeemPasswordToken(token, "Fresh-Password-1"))?.id).toBe(user.id);
    expect((await authenticate(EMAIL, "Fresh-Password-1")).ok).toBe(true);
    expect((await authenticate(EMAIL, "SENSO-Dev-2026")).ok).toBe(false);
    // Spent.
    expect(await redeemPasswordToken(token, "Another-Password-2")).toBeNull();
  });

  it("refuses an expired link and only honours the latest one", async () => {
    const user = (await findUserByEmail(EMAIL))!;
    const first = await issuePasswordToken(user.id, "invite");
    const second = await issuePasswordToken(user.id, "invite");
    expect(await redeemPasswordToken(first, "Fresh-Password-3")).toBeNull();

    user.passwordToken!.expiresAt = new Date(Date.now() - 1000).toISOString();
    expect(await redeemPasswordToken(second, "Fresh-Password-3")).toBeNull();
  });
});
