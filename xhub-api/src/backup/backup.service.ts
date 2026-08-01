import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  BACKUP_TABLES,
  EXCLUDED_DATA,
  FK_REFS,
  SUBJECT_TYPE_MODEL,
  assertNoSecretFields,
  contentChecksum,
} from './backup.tables';
import {
  BACKUP_ALGORITHM,
  BACKUP_KEY_REFERENCE,
  EncryptedBundle,
  decrypt,
  encrypt,
} from './backup.crypto';

const BACKUP_SCHEMA_VERSION = '1.0';
const APPLICATION_VERSION = process.env.npm_package_version ?? '0.0.1';

type Row = Record<string, any>;

/** Top-level DateTime column names across the backup tables (allow-list). */
const DATE_FIELDS = [
  'createdAt', 'updatedAt', 'finishedAt', 'actedAt', 'escalatedAt', 'readAt',
  'fromAt', 'toAt', 'resolvedAt', 'snapshotAt', 'lastSyncedAt', 'enteredAt',
  'effectiveFrom', 'effectiveTo', 'dueAt', 'at',
];

interface BackupPayload {
  manifest: Record<string, any>;
  data: Record<string, Row[]>;
}

export interface RestoreOptions {
  mode: 'dry-run' | 'sandbox';
  targetTenantId?: string;
  /** Test hook (mirrors controlplane __failUntilAttempt): forces checksum mismatch. */
  tamper?: 'checksum';
}

/**
 * BackupService — per-tenant LOGICAL backup / restore (Mục 6).
 *
 * Backup (export): runs inside the caller's withTenant(source) context (opened
 * by TenantScopeInterceptor) so every findMany is RLS-scoped to the ONE source
 * tenant. Rows are secret-scanned, checksummed (sha256 over canonical rows),
 * and written as an AES-256-GCM encrypted bundle under a per-tenant folder,
 * with a BackupJob row + plaintext manifest (row counts, checksum, outbox
 * watermark, excludedData, encryption reference — never a secret or a key).
 *
 * Restore: the controller handler is SKIPPED by the interceptor (no source
 * context is pinned) so this service can manage its own contexts. All DB work
 * runs under withBypass with EXPLICIT tenantId scoping — restore is legitimately
 * cross-tenant (source read → sandbox write). It NEVER overwrites the live
 * source tenant: dry-run validates only; sandbox loads into a separate tenant
 * (`<source>:restore-sandbox` by default) after checksum verify + identity
 * remap (PersonProfile UUIDs regenerated, FK references rewritten consistently).
 */
@Injectable()
export class BackupService {
  constructor(private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.db;
  }

  private storageDir(tenantId: string, backupId: string): string {
    const base = process.env.BACKUP_STORAGE_DIR ?? join(process.cwd(), 'storage', 'backups');
    return join(base, tenantId, backupId);
  }

  // ==== backup (export) ======================================================

  /**
   * Export ONE tenant's logical data (RLS-scoped by the surrounding withTenant).
   * Returns the completed BackupJob + its manifest.
   */
  async createBackup(tenantId: string, actorId?: string, kind = 'LOGICAL_TENANT') {
    // Create the job first (running) so its id names the storage folder.
    const job = await this.db.backupJob.create({
      data: { tenantId, status: 'running', kind },
    });

    try {
      const data: Record<string, Row[]> = {};
      const tableCounts: Record<string, number> = {};
      let totalRows = 0;
      let secretFieldsScanned = 0;

      for (const { model, table } of BACKUP_TABLES) {
        // RLS scopes to the source tenant; explicit tenantId filter is
        // defense-in-depth (belt-and-suspenders with RLS).
        const rows: Row[] = await (this.db as any)[model].findMany({
          where: { tenantId },
          orderBy: { id: 'asc' },
        });
        // MUST_NOT_LEAK: no secret/credential field may ever be serialized.
        secretFieldsScanned += assertNoSecretFields(rows);
        data[table] = rows;
        tableCounts[table] = rows.length;
        totalRows += rows.length;
      }

      // Outbox watermark: the in-flight cutoff so restore knows what was pending.
      const pcmds = data['ProvisioningCommand'] ?? [];
      const sorted = [...pcmds].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
      const last = sorted[sorted.length - 1];
      const outboxWatermark = {
        provisioningCommandCount: pcmds.length,
        maxId: last?.id ?? null,
        maxCreatedAt: last?.createdAt ?? null,
      };

      const checksum = contentChecksum(data);

      const manifest = {
        backupId: job.id,
        tenantId,
        createdAt: new Date().toISOString(),
        schemaVersion: BACKUP_SCHEMA_VERSION,
        applicationVersion: APPLICATION_VERSION,
        kind,
        tables: tableCounts,
        totalRows,
        checksum,
        outboxWatermark,
        excludedData: EXCLUDED_DATA,
        encryption: { algorithm: BACKUP_ALGORITHM, keyReference: BACKUP_KEY_REFERENCE },
        secretGuard: { status: 'passed', fieldsScanned: secretFieldsScanned },
        createdBy: actorId ?? null,
      };

      const payload: BackupPayload = { manifest, data };
      const enc = encrypt(JSON.stringify(payload));
      const byteSize = Buffer.from(enc.ciphertext, 'base64').length;

      const dir = this.storageDir(tenantId, job.id);
      mkdirSync(dir, { recursive: true });
      // Plaintext manifest (NO secret, NO key) + encrypted bundle.
      writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
      writeFileSync(join(dir, 'bundle.enc'), JSON.stringify(enc));
      const location = join('storage', 'backups', tenantId, job.id);

      const completed = await this.db.backupJob.update({
        where: { id: job.id },
        data: {
          status: 'completed',
          manifest: manifest as any,
          checksum,
          outboxWatermark: outboxWatermark as any,
          byteSize,
          location,
          finishedAt: new Date(),
        },
      });
      return { job: completed, manifest };
    } catch (e: any) {
      await this.db.backupJob.update({
        where: { id: job.id },
        data: { status: 'failed', error: String(e?.message ?? e), finishedAt: new Date() },
      });
      throw e;
    }
  }

  listBackups(tenantId: string) {
    return this.db.backupJob.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
  }

  async getBackup(tenantId: string, id: string) {
    const job = await this.db.backupJob.findFirst({ where: { id, tenantId } });
    if (!job) throw new NotFoundException(`backup job not found: ${id}`);
    return job;
  }

  /** Decrypt the produced bundle and confirm its checksum matches the manifest. */
  async verifyBackup(tenantId: string, id: string) {
    const job = await this.getBackup(tenantId, id);
    const payload = this.loadBundle(tenantId, id);
    const actual = contentChecksum(payload.data);
    const expected = (payload.manifest.checksum as string) ?? job.checksum;
    return {
      backupId: id,
      checksumValid: actual === expected && actual === job.checksum,
      expected,
      actual,
    };
  }

  private loadBundle(tenantId: string, id: string): BackupPayload {
    const dir = this.storageDir(tenantId, id);
    let enc: EncryptedBundle;
    try {
      enc = JSON.parse(readFileSync(join(dir, 'bundle.enc'), 'utf8'));
    } catch {
      throw new NotFoundException(`backup bundle missing for ${id}`);
    }
    return JSON.parse(decrypt(enc)) as BackupPayload;
  }

  // ==== restore (sandbox / dry-run) =========================================

  /**
   * Restore a backup. NEVER writes to the live source tenant. Cross-tenant, so
   * it runs under withBypass with explicit tenantId scoping (the controller
   * handler is skipped by the interceptor).
   */
  async restore(sourceTenantId: string, backupId: string, opts: RestoreOptions) {
    const mode = opts.mode;
    if (mode !== 'dry-run' && mode !== 'sandbox') {
      throw new BadRequestException(`mode must be 'dry-run' | 'sandbox' (got ${mode})`);
    }

    return this.prisma.withBypass(async () => {
      const backup = await this.db.backupJob.findFirst({ where: { id: backupId, tenantId: sourceTenantId } });
      if (!backup) throw new NotFoundException(`backup job not found: ${backupId}`);

      const targetTenantId = opts.targetTenantId ?? `${sourceTenantId}:restore-sandbox`;

      const restoreJob = await this.db.restoreJob.create({
        data: {
          tenantId: sourceTenantId,
          status: 'running',
          kind: 'FULL_REPLACE_TENANT',
          mode,
          sourceBackupId: backupId,
          targetTenantId,
          checksum: backup.checksum,
          outboxWatermark: backup.outboxWatermark as any,
          location: backup.location,
        },
      });

      try {
        const payload = this.loadBundle(sourceTenantId, backupId);

        // 1) Verify checksum (reject on mismatch). tamper hook corrupts expected.
        const actual = contentChecksum(payload.data);
        let expected = payload.manifest.checksum as string;
        if (opts.tamper === 'checksum') expected = `${expected}-tampered`;
        const checksumValid = actual === expected;
        if (!checksumValid) {
          await this.failRestore(restoreJob.id, 'checksum mismatch — refusing restore');
          throw new BadRequestException('backup checksum verification failed — restore rejected');
        }

        // 2) Verify schemaVersion.
        if (payload.manifest.schemaVersion !== BACKUP_SCHEMA_VERSION) {
          await this.failRestore(restoreJob.id, `schemaVersion mismatch (${payload.manifest.schemaVersion})`);
          throw new BadRequestException('backup schemaVersion incompatible — restore rejected');
        }

        const wouldCounts: Record<string, number> = {};
        let totalRows = 0;
        for (const { table } of BACKUP_TABLES) {
          const n = (payload.data[table] ?? []).length;
          wouldCounts[table] = n;
          totalRows += n;
        }

        // 3) DRY-RUN: report only, write nothing.
        if (mode === 'dry-run') {
          const report = {
            mode,
            targetTenantId,
            checksumValid: true,
            wouldWrite: false,
            tables: wouldCounts,
            totalRows,
            outboxWatermark: payload.manifest.outboxWatermark,
          };
          const done = await this.db.restoreJob.update({
            where: { id: restoreJob.id },
            data: { status: 'completed', report: report as any, manifest: payload.manifest as any, finishedAt: new Date() },
          });
          return { restoreJob: done, report };
        }

        // 4) SANDBOX: identity remap + load into the target tenant.
        const report = await this.loadIntoSandbox(sourceTenantId, targetTenantId, payload);
        const done = await this.db.restoreJob.update({
          where: { id: restoreJob.id },
          data: { status: 'completed', report: report as any, manifest: payload.manifest as any, finishedAt: new Date() },
        });
        return { restoreJob: done, report };
      } catch (e: any) {
        if (e instanceof BadRequestException) throw e;
        await this.failRestore(restoreJob.id, String(e?.message ?? e));
        throw e;
      }
    });
  }

  private async failRestore(id: string, error: string) {
    await this.db.restoreJob.update({ where: { id }, data: { status: 'failed', error, finishedAt: new Date() } });
  }

  listRestores(tenantId: string) {
    return this.db.restoreJob.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
  }

  /**
   * Wipe (FULL_REPLACE) the target tenant's rows for the backup tables, then
   * insert the remapped rows in dependency order. Must be called inside a bypass
   * context. Returns the restore report (counts + identity remap + consistency).
   */
  private async loadIntoSandbox(
    sourceTenantId: string,
    targetTenantId: string,
    payload: BackupPayload,
  ) {
    if (targetTenantId === sourceTenantId) {
      throw new BadRequestException('refusing to restore into the live source tenant');
    }

    // Ensure a Tenant row exists for the sandbox (Workflow/AuditLog/… FK to it).
    await (this.db as any).tenant.upsert({
      where: { id: targetTenantId },
      update: {},
      create: { id: targetTenantId, slug: targetTenantId, name: `Restore sandbox of ${sourceTenantId}` },
    });

    // Wipe existing target rows (reverse dependency order) → re-runnable.
    for (const { model } of [...BACKUP_TABLES].reverse()) {
      await (this.db as any)[model].deleteMany({ where: { tenantId: targetTenantId } });
    }

    // Pass 1: generate a new id for every row of every table.
    const idMap: Record<string, Map<string, string>> = {};
    for (const { model, table } of BACKUP_TABLES) {
      const map = new Map<string, string>();
      for (const row of payload.data[table] ?? []) map.set(row.id, randomUUID());
      idMap[model] = map;
    }

    const remap = (model: string, oldId: string | null | undefined): string | null | undefined => {
      if (oldId == null) return oldId;
      return idMap[model]?.get(oldId) ?? oldId; // unknown ref → keep (external)
    };

    // Pass 2 + 3: rewrite + insert in dependency order.
    const insertedCounts: Record<string, number> = {};
    let inFlightHeld = 0;

    for (const { model, table } of BACKUP_TABLES) {
      const rows = payload.data[table] ?? [];
      let inserted = 0;
      for (const src of rows) {
        const row: Row = { ...src };
        row.id = idMap[model].get(src.id)!;
        row.tenantId = targetTenantId;

        // Rewrite declared FK references.
        for (const ref of FK_REFS[model] ?? []) {
          if (ref.array) {
            const arr: string[] = Array.isArray(row[ref.field]) ? row[ref.field] : [];
            row[ref.field] = arr.map((v) => remap(ref.refModel, v));
          } else {
            row[ref.field] = remap(ref.refModel, row[ref.field]);
          }
        }

        // Polymorphic subjectId (RoleBinding / DataScope).
        if ((model === 'roleBinding' || model === 'dataScope') && row.subjectId) {
          const refModel = SUBJECT_TYPE_MODEL[row.subjectType];
          if (refModel) row.subjectId = remap(refModel, row.subjectId);
        }

        // Outbox: hold restored in-flight commands so nothing double-executes.
        if (model === 'provisioningCommand' && (row.status === 'pending' || row.status === 'sent')) {
          row.status = 'completed';
          row.result = { ...(row.result ?? {}), restoredHold: true, note: 'in-flight at backup watermark; not re-executed on restore' };
          inFlightHeld++;
        }

        // Coerce ISO date strings back to Date for Prisma.
        this.coerceDates(row);

        await (this.db as any)[model].create({ data: row });
        inserted++;
      }
      insertedCounts[table] = inserted;
    }

    // Consistency check: every restored Position.holderPersonId resolves to a
    // restored PersonProfile in the target tenant.
    const targetPersons: { id: string }[] = await (this.db as any).personProfile.findMany({
      where: { tenantId: targetTenantId },
      select: { id: true },
    });
    const targetPersonIds = new Set(targetPersons.map((p) => p.id));
    const targetPositions: { holderPersonId: string | null }[] = await (this.db as any).position.findMany({
      where: { tenantId: targetTenantId },
      select: { holderPersonId: true },
    });
    const danglingHolders = targetPositions.filter(
      (p) => p.holderPersonId != null && !targetPersonIds.has(p.holderPersonId),
    ).length;

    const personRemap = [...idMap.personProfile.entries()].map(([oldId, newId]) => ({ oldId, newId }));

    return {
      mode: 'sandbox',
      targetTenantId,
      checksumValid: true,
      wouldWrite: true,
      tables: insertedCounts,
      totalRows: Object.values(insertedCounts).reduce((a, b) => a + b, 0),
      identityRemap: { PersonProfile: personRemap },
      sourcePersonIds: personRemap.map((r) => r.oldId),
      targetPersonIds: personRemap.map((r) => r.newId),
      consistent: danglingHolders === 0,
      danglingHolders,
      outboxWatermark: payload.manifest.outboxWatermark,
      inFlightHeld,
    };
  }

  // ==== Tenant Lifecycle — DEMO baseline / reset-in-place / clear ===========

  private async readTenant(tenantId: string): Promise<{ id: string; mode: string | null } | null> {
    return this.prisma.withBypass<any>(() =>
      (this.db as any).tenant.findUnique({ where: { id: tenantId }, select: { id: true, mode: true } }),
    );
  }

  /** The immutable golden DEMO_BASELINE job for a tenant (most recent completed), or null. */
  async findDemoBaseline(tenantId: string) {
    return this.prisma.withBypass<any>(() =>
      (this.db as any).backupJob.findFirst({
        where: { tenantId, kind: 'DEMO_BASELINE', status: 'completed' },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  /**
   * Capture ONE immutable DEMO_BASELINE snapshot for a demo tenant. Idempotent:
   * if a completed DEMO_BASELINE already exists it is returned and NO new backup
   * is taken. Runs the backup export under the tenant's RLS context.
   */
  async ensureDemoBaseline(tenantId: string, actorId?: string) {
    const existing = await this.findDemoBaseline(tenantId);
    if (existing) return { job: existing, created: false };
    const { job } = await this.prisma.withTenant(tenantId, () =>
      this.createBackup(tenantId, actorId ?? 'platform', 'DEMO_BASELINE'),
    );
    return { job, created: true };
  }

  /**
   * RESET-DEMO — restore the DEMO_BASELINE IN-PLACE into the same tenant. ONLY
   * for tenant.mode='DEMO' (asserts; never overwrites a LIVE tenant). Takes a
   * safety snapshot first, then wipes the tenant's current business rows and
   * re-loads the baseline verbatim (same ids — no remap, same tenant). Runs the
   * wipe+load under withBypass with EXPLICIT tenantId scoping; only THIS tenant's
   * rows are ever touched (MUST_NOT_LEAK preserved). Audits the reset.
   */
  async resetToBaseline(tenantId: string, actorId?: string) {
    const tenant = await this.readTenant(tenantId);
    if (!tenant) throw new NotFoundException(`tenant not found: ${tenantId}`);
    // GUARD: reset-in-place is a DEMO-ONLY destructive operation → 409 otherwise
    // (never overwrite a LIVE tenant; go-live is one-way).
    if (tenant.mode !== 'DEMO') {
      throw new ConflictException(
        `reset-demo is only allowed for DEMO tenants (tenant ${tenantId} mode=${tenant.mode ?? 'null'})`,
      );
    }
    const baseline = await this.findDemoBaseline(tenantId);
    if (!baseline) {
      throw new NotFoundException(`no DEMO_BASELINE exists for tenant ${tenantId} — run ensure:demo-baselines`);
    }

    // 1) Safety snapshot BEFORE any destructive change.
    const safety = await this.prisma.withTenant(tenantId, () =>
      this.createBackup(tenantId, actorId ?? 'platform', 'RESET_SAFETY'),
    );

    // 2) Wipe + reload baseline in-place (bypass, explicit tenant scoping).
    const report = await this.prisma.withBypass(async () => {
      const payload = this.loadBundle(tenantId, baseline.id);
      // Verify checksum before touching data.
      const actual = contentChecksum(payload.data);
      if (actual !== payload.manifest.checksum) {
        throw new BadRequestException('DEMO_BASELINE checksum verification failed — reset rejected');
      }
      return this.loadInPlace(tenantId, payload);
    });

    // 3) Audit (tenant-scoped AuditLog under bypass with explicit tenantId).
    await this.audit(tenantId, actorId, 'tenant.reset-demo', {
      baselineBackupId: baseline.id,
      safetySnapshotId: safety.job.id,
      tables: report.tables,
      totalRows: report.totalRows,
    });

    return {
      tenantId,
      mode: 'DEMO',
      baselineBackupId: baseline.id,
      safetySnapshotId: safety.job.id,
      ...report,
    };
  }

  /**
   * Wipe the tenant's rows for every backup table (reverse dependency order),
   * then insert the baseline rows VERBATIM (same ids — same tenant, no remap).
   * Must run inside a withBypass context.
   */
  private async loadInPlace(tenantId: string, payload: BackupPayload) {
    // Wipe existing rows (reverse dependency order) — re-runnable.
    for (const { model } of [...BACKUP_TABLES].reverse()) {
      await (this.db as any)[model].deleteMany({ where: { tenantId } });
    }
    const insertedCounts: Record<string, number> = {};
    for (const { model, table } of BACKUP_TABLES) {
      const rows = payload.data[table] ?? [];
      let inserted = 0;
      for (const src of rows) {
        const row: Row = { ...src, tenantId };
        this.coerceDates(row);
        await (this.db as any)[model].create({ data: row });
        inserted++;
      }
      insertedCounts[table] = inserted;
    }
    return {
      tables: insertedCounts,
      totalRows: Object.values(insertedCounts).reduce((a, b) => a + b, 0),
    };
  }

  /**
   * CLEAR demo business/operational data for a tenant at GO-LIVE. Deletes the
   * tenant's demo-seeded business + vertical module rows (child→parent order),
   * KEEPING org structure, identity, roles, memberships, workflow definitions,
   * credentials and the AuditLog trail (unless clearAll). Raw SQL DELETE scoped
   * by tenantId under bypass — never touches another tenant. Returns row counts.
   */
  async clearDemoData(tenantId: string, clearAll = false): Promise<{ cleared: Record<string, number>; total: number }> {
    // child → parent order so FK constraints hold.
    const BUSINESS_TABLES = [
      'TicketEvent', 'Ticket', 'ServiceCatalogItem',
      'BookingEvent', 'Booking', 'BookableResource',
      'AnnouncementReceipt', 'AnnouncementEvent', 'Announcement',
      'RequestComment', 'RequestEvent', 'Request',
      'DirectiveAssignment', 'DirectiveEvent', 'Directive',
      'DocumentVersion', 'RecordDocument',
      'Notification', 'UnifiedWorkItem', 'CommandLog', 'ExternalExecution',
      'ConnectorCommand', 'WorkflowEvent', 'ApprovalTask', 'WorkflowInstance',
      'ProvisioningConflict', 'ProvisioningCommand',
      'DuplicatePair', 'SourceRecord', 'ImportJob', 'TenantMasterOverlay',
    ];
    // clearAll ALSO wipes org/identity/roles (blank-slate) but NEVER credentials
    // or the audit trail (kept for traceability).
    const IDENTITY_TABLES = clearAll
      ? ['AssignmentResolution', 'DataScope', 'PermissionPolicy', 'RoleBinding', 'Group',
         'Position', 'OrgUnit', 'PersonProfile', 'Delegation', 'AppAccountBinding',
         'AppRoleMapping', 'TenantApplicationInstance']
      : [];
    const tables = [...BUSINESS_TABLES, ...IDENTITY_TABLES];

    return this.prisma.withBypass(async () => {
      const cleared: Record<string, number> = {};
      let total = 0;
      for (const t of tables) {
        try {
          const res: any = await this.db.$executeRawUnsafe(
            `DELETE FROM "${t}" WHERE "tenantId" = $1`,
            tenantId,
          );
          const n = typeof res === 'number' ? res : 0;
          if (n > 0) cleared[t] = n;
          total += n;
        } catch {
          /* table may not exist / no rows — best-effort */
        }
      }
      return { cleared, total };
    });
  }

  /** Tenant-scoped AuditLog append under bypass with explicit tenantId (best-effort). */
  private async audit(tenantId: string, actorId: string | undefined, action: string, detail: Record<string, any>) {
    try {
      await this.prisma.withBypass(() =>
        (this.db as any).auditLog.create({
          data: {
            tenantId,
            actorId: actorId || 'platform',
            instanceCode: 'platform.tenant-lifecycle',
            action,
            detail: JSON.stringify(detail),
          },
        }),
      );
    } catch {
      /* best-effort */
    }
  }

  /**
   * Convert the KNOWN top-level DateTime columns back into Date objects (JSON
   * round-trip turned them into ISO strings). Restricted to an allow-list of
   * column NAMES so a String column that merely looks like a timestamp (e.g.
   * UnifiedWorkItem.sourceVersion) is left untouched.
   */
  private coerceDates(row: Row): void {
    for (const k of DATE_FIELDS) {
      const v = row[k];
      if (typeof v === 'string') row[k] = new Date(v);
    }
  }
}
