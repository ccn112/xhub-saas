import { Injectable, OnModuleInit } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type Row = Record<string, unknown>;

/**
 * Loads the canonical seed once and serves tenant-scoped reads.
 * This is the DB boundary: clients never touch storage directly — they call
 * this service (via the controller) which enforces tenant isolation.
 */
@Injectable()
export class SeedService implements OnModuleInit {
  private db: Record<string, Row[] | Row> = {};
  private meta: Record<string, unknown> = {};
  canonicalTenantId = 'tenant-xtech';

  onModuleInit() {
    const file = join(process.cwd(), 'seed-data', 'all.seed.json');
    this.db = JSON.parse(readFileSync(file, 'utf8'));
    this.meta = (this.db['meta'] as Record<string, unknown>) ?? {};
    this.canonicalTenantId = (this.meta['canonicalTenantId'] as string) ?? 'tenant-xtech';
  }

  private assertScope(rows: Row[], tenantId: string): Row[] {
    const scoped = rows.filter(
      (r) => r['tenantId'] === undefined || r['tenantId'] === tenantId,
    );
    if (scoped.some((r) => JSON.stringify(r).includes('MUST_NOT_LEAK'))) {
      throw new Error('Tenant isolation violation: MUST_NOT_LEAK detected.');
    }
    return scoped;
  }

  getMeta() {
    return this.meta;
  }

  listNames(): string[] {
    return Object.keys(this.db).filter((k) => Array.isArray(this.db[k]));
  }

  collection(name: string, tenantId: string): Row[] {
    const rows = this.db[name];
    if (!Array.isArray(rows)) return [];
    return this.assertScope(rows, tenantId);
  }

  byId(name: string, id: string, tenantId: string): Row | undefined {
    return this.collection(name, tenantId).find((r) => r['id'] === id);
  }
}
