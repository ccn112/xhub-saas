import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * HMAC-SHA256 signature helpers for inbound webhooks (Mục 8b). The signing
 * secret lives in env WEBHOOK_SIGNING_SECRET and is used ONLY to verify the
 * signature — it is NEVER persisted. The signature is computed over the RAW
 * request body bytes (so re-serialization can't change it).
 */
export const WEBHOOK_SIGNATURE_HEADER = 'x-webhook-signature';
export const WEBHOOK_ID_HEADER = 'x-webhook-id';

export function signingSecret(): string {
  return process.env.WEBHOOK_SIGNING_SECRET ?? 'dev-webhook-secret';
}

/** Hex HMAC-SHA256 of `raw` under the signing secret. */
export function computeSignature(raw: Buffer | string): string {
  return createHmac('sha256', signingSecret())
    .update(typeof raw === 'string' ? Buffer.from(raw, 'utf8') : raw)
    .digest('hex');
}

/** Constant-time compare of a provided signature against the expected one. */
export function verifySignature(raw: Buffer | string, provided: string | undefined): boolean {
  if (!provided) return false;
  const expected = computeSignature(raw);
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(provided, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
