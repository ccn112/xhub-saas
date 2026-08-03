import 'dotenv/config';
import { createHash } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';
import { isStagingStrict } from './auth/identity.types';

/**
 * Best-effort startup guard (Mục 8d): warn LOUDLY if the running
 * ANTHROPIC_API_KEY matches a fingerprint of a known-leaked key. We store only a
 * sha256 fingerprint prefix — never the key itself — and the human must rotate
 * the real key at console.anthropic.com and replace it via env.
 */
const LEAKED_KEY_FINGERPRINTS = new Set<string>([
  'd9d24a2d90654ea4', // committed/handoff-exposed key — ROTATE at console.anthropic.com
]);

function leakedKeyFingerprint(): string | undefined {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return undefined;
  const fp = createHash('sha256').update(key).digest('hex').slice(0, 16);
  return LEAKED_KEY_FINGERPRINTS.has(fp) ? fp : undefined;
}

function warnOnLeakedKey(): void {
  const fp = leakedKeyFingerprint();
  if (!fp) return;
  // eslint-disable-next-line no-console
  console.warn(
    '\n[SECURITY] ANTHROPIC_API_KEY matches a KNOWN-LEAKED key fingerprint ' +
      `(${fp}). Rotate it now at https://console.anthropic.com/settings/keys ` +
      'and set the new value via env only. See SECURITY.md.\n',
  );
}

/**
 * Hard-fail startup guard, gated by STAGING_STRICT (G0 remediation — see
 * XOffice Business Operations handoff Gate G0). Every check here is a
 * demo-safe default elsewhere in this codebase (PermissionGuard no-op,
 * client-trusted header identity, unrotated leaked key); STAGING_STRICT is the
 * opt-in that turns them from soft defaults into a refusal to boot, so a real
 * deployment can't silently inherit demo settings. Local/demo profiles never
 * set STAGING_STRICT and are completely unaffected.
 */
function assertSecureStartup(): void {
  if (!isStagingStrict()) return;
  const problems: string[] = [];
  if (leakedKeyFingerprint()) {
    problems.push('ANTHROPIC_API_KEY still matches a known-leaked fingerprint — rotate it before deploying.');
  }
  if (String(process.env.AUTH_ENFORCE ?? '').toLowerCase() !== 'true') {
    problems.push('AUTH_ENFORCE must be "true" (PermissionGuard would otherwise allow every request through).');
  }
  if (String(process.env.AUTH_ALLOW_HEADER_IDENTITY ?? 'true').toLowerCase() !== 'false') {
    problems.push('AUTH_ALLOW_HEADER_IDENTITY must be "false" (client-supplied x-user-id/x-tenant-id must not be trusted).');
  }
  if (problems.length > 0) {
    // eslint-disable-next-line no-console
    console.error(
      '\n[SECURITY] STAGING_STRICT startup check failed:\n' +
        problems.map((p) => `  - ${p}`).join('\n') +
        '\n',
    );
    process.exit(1);
  }
}

async function bootstrap() {
  warnOnLeakedKey();
  assertSecureStartup();
  // rawBody:true exposes req.rawBody (Buffer) so inbound webhooks can verify the
  // HMAC signature over the exact bytes received (Mục 8b).
  const app = await NestFactory.create(AppModule, { rawBody: true });
  // Parse cookies so IdentityGuard can read the `xhub_session` JWT.
  app.use(cookieParser());
  // Frontend (xhub-web) runs on 3000/3001 in dev.
  app.enableCors({ origin: [/localhost:\d+$/], credentials: true });
  const prisma = app.get(PrismaService);
  prisma.enableShutdownHooks(app);
  await app.listen(process.env.PORT ?? 4000);
}
void bootstrap();
