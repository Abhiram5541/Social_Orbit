import { afterEach, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { notifyChannels, signPayload } from "./notification-service";

/*
 * Only the parts a mistake in would be invisible: the signature a receiver
 * verifies against, and the configured-channel report the catalog grades from.
 * The senders themselves are one fetch each — exercised for real by the
 * nightly cron, not faked here.
 */

const KEY = "WEBHOOK_SIGNING_SECRET";
const original = process.env[KEY];

afterEach(() => {
  if (original === undefined) delete process.env[KEY];
  else process.env[KEY] = original;
});

describe("signPayload", () => {
  it("produces a receiver-verifiable sha256 HMAC over the exact bytes", () => {
    process.env[KEY] = "test-secret";
    const body = JSON.stringify({ event: "shortlist.updated", id: "sl_1" });

    const signature = signPayload(body);

    const expected = `sha256=${createHmac("sha256", "test-secret").update(body, "utf8").digest("hex")}`;
    expect(signature).toBe(expected);
  });

  it("refuses to sign with no secret rather than signing with an empty one", () => {
    delete process.env[KEY];
    expect(signPayload("{}")).toBeNull();
  });

  it("treats a whitespace-only secret as unset", () => {
    process.env[KEY] = "   ";
    expect(signPayload("{}")).toBeNull();
    expect(notifyChannels().webhook).toBe(false);
  });
});
