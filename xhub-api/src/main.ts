import 'dotenv/config';
import { createHash } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';

/**
 * Best-effort startup guard (Mục 8d): warn LOUDLY if the running
 * ANTHROPIC_API_KEY matches a fingerprint of a known-leaked key. We store only a
 * sha256 fingerprint prefix — never the key itself — and the human must rotate
 * the real key at console.anthropic.com and replace it via env.
 */
const LEAKED_KEY_FINGERPRINTS = new Set<string>([
  'd9d24a2d90654ea4', // committed/handoff-exposed key — ROTATE at console.anthropic.com
]);

function warnOnLeakedKey(): void {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return;
  const fp = createHash('sha256').update(key).digest('hex').slice(0, 16);
  if (LEAKED_KEY_FINGERPRINTS.has(fp)) {
    // eslint-disable-next-line no-console
    console.warn(
      '\n[SECURITY] ANTHROPIC_API_KEY matches a KNOWN-LEAKED key fingerprint ' +
        `(${fp}). Rotate it now at https://console.anthropic.com/settings/keys ` +
        'and set the new value via env only. See SECURITY.md.\n',
    );
  }
}

async function bootstrap() {
  warnOnLeakedKey();
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
