import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Encryption-at-rest for the logical backup bundle (Mục 6).
 *
 * AES-256-GCM. The 32-byte key comes from env `BACKUP_ENCRYPTION_KEY` (base64).
 * If it is absent, a DEV key is generated once per process and logged (base64)
 * so restores within the same run still work — but the bundle is ALWAYS
 * encrypted (never written in the clear, per the handoff rule "no unencrypted
 * backup on a dev machine"). The manifest stores only the algorithm + a key
 * REFERENCE (`env:BACKUP_ENCRYPTION_KEY`) — never the key itself.
 */
export const BACKUP_ALGORITHM = 'aes-256-gcm';
export const BACKUP_KEY_REFERENCE = 'env:BACKUP_ENCRYPTION_KEY';

let cachedKey: Buffer | null = null;

export function getBackupKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.BACKUP_ENCRYPTION_KEY;
  if (raw) {
    const key = Buffer.from(raw, 'base64');
    if (key.length !== 32) {
      throw new Error(`BACKUP_ENCRYPTION_KEY must decode to 32 bytes (got ${key.length})`);
    }
    cachedKey = key;
    return key;
  }
  // Dev fallback: generate + log once. Bundle is still encrypted.
  cachedKey = randomBytes(32);
  // eslint-disable-next-line no-console
  console.warn(
    `[backup] BACKUP_ENCRYPTION_KEY not set — generated a DEV key for this process: ` +
      `${cachedKey.toString('base64')} (set BACKUP_ENCRYPTION_KEY in .env for persistence)`,
  );
  return cachedKey;
}

export interface EncryptedBundle {
  algorithm: string;
  iv: string; // base64
  authTag: string; // base64
  ciphertext: string; // base64
}

export function encrypt(plaintext: string): EncryptedBundle {
  const iv = randomBytes(12);
  const cipher = createCipheriv(BACKUP_ALGORITHM, getBackupKey(), iv);
  const ct = Buffer.concat([cipher.update(Buffer.from(plaintext, 'utf8')), cipher.final()]);
  return {
    algorithm: BACKUP_ALGORITHM,
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    ciphertext: ct.toString('base64'),
  };
}

export function decrypt(bundle: EncryptedBundle): string {
  const decipher = createDecipheriv(BACKUP_ALGORITHM, getBackupKey(), Buffer.from(bundle.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(bundle.authTag, 'base64'));
  const pt = Buffer.concat([decipher.update(Buffer.from(bundle.ciphertext, 'base64')), decipher.final()]);
  return pt.toString('utf8');
}
