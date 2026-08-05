import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

const MAX_EVIDENCE_BYTES = 8 * 1024 * 1024; // 8MB cap per pasted/uploaded screenshot.
const MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
};
const EXT_TO_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
};

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

  private evidenceDir(tenantId: string): string {
    return join(this.tenantDir(tenantId), 'evidence');
  }

  /** Reject path traversal / separators in any user-supplied path segment. */
  private safeSegment(seg: string): string {
    if (!seg || /[\\/]/.test(seg) || seg.includes('..')) {
      throw new BadRequestException(`invalid path segment: ${seg}`);
    }
    return seg;
  }

  /**
   * Save a pasted/uploaded screenshot as evidence attached to one test-case
   * row. Same disk-backed, folder-per-tenant convention as the rest of this
   * service — storage/testruns/<tenantId>/evidence/<userId>/<testCaseId>/<file>.
   */
  async putEvidence(
    tenantId: string,
    userId: string,
    testCaseId: string,
    contentBase64: string,
    mimeType: string,
  ): Promise<{ userId: string; testCaseId: string; filename: string }> {
    if (!mimeType.startsWith('image/')) {
      throw new BadRequestException('only image/* evidence is supported');
    }
    const buf = Buffer.from(contentBase64, 'base64');
    if (buf.length === 0) throw new BadRequestException('empty evidence content');
    if (buf.length > MAX_EVIDENCE_BYTES) {
      throw new BadRequestException('evidence image too large (max 8MB)');
    }
    const safeUser = this.safeSegment(userId);
    const safeCase = this.safeSegment(testCaseId);
    const dir = join(this.evidenceDir(tenantId), safeUser, safeCase);
    await mkdir(dir, { recursive: true });
    const ext = MIME_TO_EXT[mimeType] ?? 'bin';
    const filename = `${Date.now()}-${randomBytes(4).toString('hex')}.${ext}`;
    await writeFile(join(dir, filename), buf);
    return { userId: safeUser, testCaseId: safeCase, filename };
  }

  /** Read back a saved evidence image (base64, for the BFF to re-serve as raw bytes). */
  async getEvidence(
    tenantId: string,
    userId: string,
    testCaseId: string,
    filename: string,
  ): Promise<{ contentBase64: string; mimeType: string }> {
    const safeUser = this.safeSegment(userId);
    const safeCase = this.safeSegment(testCaseId);
    const safeFile = this.safeSegment(filename);
    const abs = join(this.evidenceDir(tenantId), safeUser, safeCase, safeFile);
    let buf: Buffer;
    try {
      buf = await readFile(abs);
    } catch {
      throw new NotFoundException(`evidence not found: ${safeUser}/${safeCase}/${safeFile}`);
    }
    const ext = safeFile.split('.').pop() ?? '';
    const mimeType = EXT_TO_MIME[ext] ?? 'application/octet-stream';
    return { contentBase64: buf.toString('base64'), mimeType };
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
