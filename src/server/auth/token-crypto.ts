import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/* ---------------------------------------------------------------------------
 * Encryption for OAuth tokens at rest — CLAUDE.md §10.
 *
 * A refresh token is a long-lived key to a creator's analytics. Storing one in
 * plaintext means a leaked database is a leaked set of creator accounts, so
 * they are sealed before they reach the store and opened only in the process
 * that calls the platform. They are never sent to the browser.
 *
 * AES-256-GCM: the authentication tag makes a tampered ciphertext fail loudly
 * rather than decrypt to plausible rubbish.
 * ------------------------------------------------------------------------ */

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

export class TokenCryptoUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TokenCryptoUnavailable";
  }
}

function key(): Buffer {
  const configured = process.env.TOKEN_ENCRYPTION_KEY?.trim();
  if (!configured) {
    throw new TokenCryptoUnavailable(
      "TOKEN_ENCRYPTION_KEY is not set. Refusing to store an OAuth token in plaintext.",
    );
  }

  const raw = Buffer.from(configured, "base64");
  if (raw.length !== 32) {
    throw new TokenCryptoUnavailable(
      `TOKEN_ENCRYPTION_KEY must decode to 32 bytes; got ${raw.length}. ` +
        "Generate one with: openssl rand -base64 32",
    );
  }
  return raw;
}

/** True when tokens can be sealed. Lets health reporting avoid a try/catch. */
export function tokenCryptoConfigured(): boolean {
  try {
    key();
    return true;
  } catch {
    return false;
  }
}

/** `iv.ciphertext.tag`, all base64url — one opaque string for the store. */
export function sealToken(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const sealed = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);

  return [
    iv.toString("base64url"),
    sealed.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
  ].join(".");
}

export function openToken(sealed: string): string {
  const [iv, ciphertext, tag] = sealed.split(".");
  if (!iv || !ciphertext || !tag) {
    throw new TokenCryptoUnavailable("Stored token is not in the expected sealed format.");
  }

  const decipher = createDecipheriv(ALGORITHM, key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));

  // Throws if the ciphertext was altered or the key is wrong — which is the
  // point. A silently wrong token would fail much later, somewhere unhelpful.
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
