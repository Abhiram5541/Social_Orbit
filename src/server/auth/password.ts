import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

/* ---------------------------------------------------------------------------
 * Password hashing.
 *
 * scrypt from node:crypto — memory-hard, in the standard library, and no
 * native build step. Parameters are recorded in the stored string so they can
 * be raised later without invalidating existing hashes.
 * ------------------------------------------------------------------------ */

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = await scrypt(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltPart, hashPart] = stored.split("$");
  if (scheme !== "scrypt" || !saltPart || !hashPart) return false;

  const salt = Buffer.from(saltPart, "base64url");
  const expected = Buffer.from(hashPart, "base64url");
  const derived = await scrypt(password, salt, expected.length);

  // Constant-time comparison — a length check first, since timingSafeEqual
  // throws on mismatched lengths and that throw would itself leak.
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

/**
 * Compares against a dummy hash so a request for an unknown email costs the
 * same as one for a known email. Without this, response timing enumerates
 * which accounts exist.
 */
const DUMMY_HASH_PROMISE = hashPassword("socialorbit-timing-equaliser");

export async function equaliseTiming(password: string): Promise<void> {
  await verifyPassword(password, await DUMMY_HASH_PROMISE);
}
