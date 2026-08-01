import 'dotenv/config';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

// Prisma 7: connection URL lives here (no longer in schema.prisma).
// dotenv loads DATABASE_URL from .env before defineConfig reads it.
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
