import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import * as argon2 from 'argon2';

/**
 * INTERNAL auth crypto helpers (PH-00b). Passwords are hashed with argon2id;
 * one-time tokens are random and stored only as a sha256 hash. NO plaintext
 * secret is ever persisted or logged.
 */

/** Hash a user-chosen password (argon2id). Returns the encoded hash string. */
export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, { type: argon2.argon2id });
}

/** Verify a password against a stored argon2 hash. Never throws. */
export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

/** Generate a fresh single-use token: { raw } surfaced once, { hash } stored. */
export function newToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString('base64url');
  return { raw, hash: hashToken(raw) };
}

/** sha256 hash of a raw token — the ONLY form stored in AuthToken.tokenHash. */
export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/** Constant-time compare of two sha256 hex digests. */
export function tokenHashEquals(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
