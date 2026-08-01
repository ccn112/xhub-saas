import { Injectable } from '@nestjs/common';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * TestRunsService — persistence for the QA user-test checklist (/docs/test).
 *
 * LIGHT storage: NO Prisma table (keeps the fixed RLS table set at 35). Mirrors
 * the folder-per-tenant layout used by the backup/records StorageService, but as
 * a plain JSON blob per tenant+user:
 *   storage/testruns/<tenantId>/<userId>.json
 *
 * The path is scoped by tenantId (from @Identity()) so tenants cannot read each
 * other. QA ticks only — nothing sensitive is stored here.
 */
export interface TestRunBlob {
  results: Record<string, unknown>;
  meta?: Record<string, unknown>;
  updatedAt: string | null;
}

export interface TestRunSummary {
  userId: string;
  updatedAt: string | null;
  summary: { total: number; pass: number; fail: number };
}

@Injectable()
export class TestRunsService {
  private baseDir(): string {
    return process.env.TESTRUNS_STORAGE_DIR ?? join(process.cwd(), 'storage', 'testruns');
  }

  private tenantDir(tenantId: string): string {
    return join(this.baseDir(), tenantId);
  }

  private userFile(tenantId: string, userId: string): string {
    return join(this.tenantDir(tenantId), `${userId}.json`);
  }

  /** Read the saved blob for a tenant+user, or an empty blob if none exists. */
  async get(tenantId: string, userId: string): Promise<TestRunBlob> {
    try {
      const raw = await readFile(this.userFile(tenantId, userId), 'utf8');
      const parsed = JSON.parse(raw) as Partial<TestRunBlob>;
      return {
        results: (parsed.results as Record<string, unknown>) ?? {},
        meta: parsed.meta as Record<string, unknown> | undefined,
        updatedAt: parsed.updatedAt ?? null,
      };
    } catch {
      return { results: {}, updatedAt: null };
    }
  }

  /** Write (upsert) the blob for a tenant+user. Returns the new updatedAt. */
  async put(
    tenantId: string,
    userId: string,
    results: Record<string, unknown>,
    meta?: Record<string, unknown>,
  ): Promise<{ ok: true; updatedAt: string }> {
    const updatedAt = new Date().toISOString();
    const blob: TestRunBlob = { results: results ?? {}, meta, updatedAt };
    await mkdir(this.tenantDir(tenantId), { recursive: true });
    await writeFile(this.userFile(tenantId, userId), JSON.stringify(blob, null, 2), 'utf8');
    return { ok: true, updatedAt };
  }

  /** List saved results across the tenant folder (admin/tooling review). */
  async listAll(tenantId: string): Promise<TestRunSummary[]> {
    let files: string[];
    try {
      files = await readdir(this.tenantDir(tenantId));
    } catch {
      return [];
    }
    const out: TestRunSummary[] = [];
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      const userId = f.replace(/\.json$/, '');
      const blob = await this.get(tenantId, userId);
      out.push({
        userId,
        updatedAt: blob.updatedAt,
        summary: this.summarize(blob.results),
      });
    }
    return out;
  }

  /** Count pass/fail across a results map (rows shaped { result: 'pass'|'fail'|... }). */
  private summarize(results: Record<string, unknown>): {
    total: number;
    pass: number;
    fail: number;
  } {
    let pass = 0;
    let fail = 0;
    let total = 0;
    for (const v of Object.values(results ?? {})) {
      const r = (v as { result?: string } | null)?.result;
      if (r === 'pass') { pass++; total++; }
      else if (r === 'fail') { fail++; total++; }
    }
    return { total, pass, fail };
  }
}
