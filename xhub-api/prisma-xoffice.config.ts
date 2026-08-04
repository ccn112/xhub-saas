import 'dotenv/config';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

// Phase 1.5 Stage C: second Prisma project (X.Office's own database, physically
// separate from XHub Platform's prisma/schema.prisma + prisma.config.ts).
// Invoke with `--config prisma-xoffice.config.ts` on any `prisma` CLI command.
export default defineConfig({
  schema: path.join('prisma-xoffice', 'schema.prisma'),
  datasource: {
    url: process.env.XOFFICE_DATABASE_URL,
    shadowDatabaseUrl: process.env.XOFFICE_SHADOW_DATABASE_URL,
  },
});
