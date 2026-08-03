import 'dotenv/config';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

// Prisma 7: connection URL lives here (no longer in schema.prisma).
// dotenv loads DATABASE_URL from .env before defineConfig reads it.
// SHADOW_DATABASE_URL is optional — only needed for `prisma migrate dev` and
// `migrate diff --from-migrations` (drift-check, see npm run migrate:drift-check).
// It must point at an empty, disposable database Prisma can freely create/drop
// tables in; never the real dev/prod DATABASE_URL.
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  datasource: {
    url: process.env.DATABASE_URL,
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
