import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openToken, sealToken } from "@/server/auth/token-crypto";
import { issueState, verifyState } from "./connection-service";

/**
 * The two pieces of the OAuth round trip that must hold on their own.
 *
 * The consent step itself needs a person at Google's sign-in page, so it is not
 * exercised here. What is exercised is everything that decides whether a
 * callback is trusted and whether a stored token is readable — the parts where
 * a mistake is a security hole rather than a broken screen.
 */

describe("connection state", () => {
  beforeEach(() => vi.stubEnv("AUTH_SECRET", "a-test-secret-of-at-least-32-characters"));
  afterEach(() => vi.unstubAllEnvs());

  it("round-trips the creator it was issued for", () => {
    expect(verifyState(issueState("yt_UCabc"))).toEqual({ influencerId: "yt_UCabc" });
  });

  it("rejects a state the server never issued", () => {
    // Without this, anyone could hand a signed-in creator a callback URL naming
    // a channel they control and have the grant attached to that profile.
    const forged = `${Buffer.from("yt_victim:" + Date.now() + ":x").toString("base64url")}.forged`;
    expect(verifyState(forged)).toBeNull();
  });

  it("rejects a state signed with a different secret", () => {
    const issued = issueState("yt_UCabc");
    vi.stubEnv("AUTH_SECRET", "a-completely-different-secret-value-32");
    expect(verifyState(issued)).toBeNull();
  });

  it("rejects a state whose payload was edited after signing", () => {
    const [encoded, signature] = issueState("yt_UCabc").split(".");
    const payload = Buffer.from(encoded, "base64url").toString("utf8");
    const swapped = Buffer.from(payload.replace("yt_UCabc", "yt_UCxyz")).toString("base64url");

    expect(verifyState(`${swapped}.${signature}`)).toBeNull();
  });

  it("expires after fifteen minutes", () => {
    const issued = issueState("yt_UCabc");
    expect(verifyState(issued)).not.toBeNull();

    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 16 * 60_000);
    expect(verifyState(issued)).toBeNull();
    vi.restoreAllMocks();
  });

  it("rejects a malformed value rather than throwing", () => {
    for (const bad of ["", "no-dot", ".", "a.b.c"]) {
      expect(() => verifyState(bad)).not.toThrow();
      expect(verifyState(bad)).toBeNull();
    }
  });
});

describe("token sealing", () => {
  // 32 bytes, base64 — the same shape the deployment guide asks for.
  beforeEach(() => vi.stubEnv("TOKEN_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64")));
  afterEach(() => vi.unstubAllEnvs());

  it("round-trips a refresh token", () => {
    const token = "1//0gRefreshTokenLookingValue_-abc";
    expect(openToken(sealToken(token))).toBe(token);
  });

  it("never stores the token in readable form", () => {
    const token = "1//0gRefreshTokenLookingValue_-abc";
    expect(sealToken(token)).not.toContain(token);
  });

  it("produces a different ciphertext every time", () => {
    // A fresh IV per seal: identical tokens sealing to identical strings would
    // let anyone reading the store see which creators share a credential.
    expect(sealToken("same")).not.toBe(sealToken("same"));
  });

  it("refuses a tampered ciphertext instead of returning rubbish", () => {
    const sealed = sealToken("secret-token");
    const [iv, ciphertext, tag] = sealed.split(".");
    const flipped = Buffer.from(ciphertext, "base64url");
    flipped[0] ^= 0xff;

    expect(() => openToken(`${iv}.${flipped.toString("base64url")}.${tag}`)).toThrow();
  });

  it("refuses to seal at all without a key", () => {
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", "");
    expect(() => sealToken("x")).toThrow(/TOKEN_ENCRYPTION_KEY/);
  });

  it("refuses a key of the wrong length", () => {
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", Buffer.alloc(16, 1).toString("base64"));
    expect(() => sealToken("x")).toThrow(/32 bytes/);
  });
});
