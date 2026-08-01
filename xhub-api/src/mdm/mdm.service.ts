import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import {
  CanonicalProject,
  canonicalKeyForProject,
  duplicateScore,
  hashRaw,
  normalizeProject,
  slug,
} from './mdm.normalize';

interface StagedItem {
  srId: string;
  canonical: CanonicalProject;
  raw: Record<string, any>;
}

interface RunImportInput {
  sourceSystem: string;
  domain?: string;
  records: Record<string, any>[];
  jobId?: string;
  createdBy?: string;
}

/**
 * MdmService — Shared Master Data Hub ingestion (S3–S4).
 *
 * Pipeline (per data/PROJECT_INGESTION_STAGES): staging → normalized → matched
 * → reviewed → committed. Data NEVER lands straight in a canonical master:
 * matching only ever creates a DRAFT proposal or PROPOSES a DuplicatePair; a
 * human resolves duplicates (merge / keep_separate) and then a commit ACTIVATES
 * the masters. There is NO fuzzy auto-merge.
 *
 * MasterRecord is the shared/platform canonical (NOT RLS): tenantId=null →
 * shared with every tenant, tenantId set → TENANT_PRIVATE; visibility is filtered
 * in code. Geography/shared masters are therefore never duplicated per tenant —
 * a tenant layers a TenantMasterOverlay. SourceRecord / ImportJob / DuplicatePair
 * / TenantMasterOverlay are tenant-scoped (RLS).
 */
@Injectable()
export class MdmService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.seed();
    } catch {
      // DB not reachable at boot → skip; endpoints degrade gracefully.
    }
  }

  private get db() {
    return this.prisma.db;
  }

  // ==== ingestion pipeline ===================================================

  /**
   * Run the full ingestion pipeline for a batch of source records within the
   * caller's context (withTenant for HTTP, withBypass for seed). Idempotent on
   * (tenantId, sourceSystem, sourceId): re-running re-stages the same records,
   * clears its own PENDING proposals + orphan DRAFT masters, then re-matches.
   * Stops at `matched` (duplicates pending) or `reviewed` (none) — commit is a
   * separate, human-triggered step.
   */
  async runImport(tenantId: string, input: RunImportInput) {
    const domain = input.domain ?? 'PROJECT';
    const { sourceSystem } = input;

    // 1) job (staging)
    const job = input.jobId
      ? await this.db.importJob.upsert({
          where: { id: input.jobId },
          update: { stage: 'staging', sourceSystem, domain },
          create: { id: input.jobId, tenantId, sourceSystem, domain, stage: 'staging', createdBy: input.createdBy },
        })
      : await this.db.importJob.create({
          data: { tenantId, sourceSystem, domain, stage: 'staging', createdBy: input.createdBy },
        });

    // 2) staging + normalize (immutable raw + canonical staging fields)
    const staged: StagedItem[] = [];
    for (const raw of input.records) {
      const sourceId = String(raw.sourceRecordId ?? raw.sourceId ?? '');
      if (!sourceId) throw new BadRequestException('every record needs sourceRecordId');
      const canonical = normalizeProject(raw);
      const sr = await this.db.sourceRecord.upsert({
        where: { tenantId_sourceSystem_sourceId: { tenantId, sourceSystem, sourceId } },
        update: {
          raw,
          rawHash: hashRaw(raw),
          normalized: canonical as any,
          matchStatus: 'unmatched',
          matchScore: null,
          masterRecordId: null,
          importJobId: job.id,
          domain,
        },
        create: {
          tenantId,
          sourceSystem,
          sourceId,
          domain,
          raw,
          rawHash: hashRaw(raw),
          normalized: canonical as any,
          matchStatus: 'unmatched',
          importJobId: job.id,
        },
      });
      staged.push({ srId: sr.id, canonical, raw });
    }
    await this.db.importJob.update({ where: { id: job.id }, data: { stage: 'normalized' } });

    // idempotent re-match: drop this job's PENDING proposals + orphan DRAFT masters
    await this.db.duplicatePair.deleteMany({ where: { importJobId: job.id, decision: 'pending' } });
    const srIds = staged.map((s) => s.srId);
    const oldDrafts = await this.db.masterRecord.findMany({
      where: { status: 'DRAFT', sourceRecords: { some: { id: { in: srIds } } } },
    });
    if (oldDrafts.length) {
      const draftIds = oldDrafts.map((d) => d.id);
      await this.db.sourceRecord.updateMany({
        where: { id: { in: srIds }, masterRecordId: { in: draftIds } },
        data: { masterRecordId: null },
      });
      await this.db.masterRecord.deleteMany({ where: { id: { in: draftIds }, sourceRecords: { none: {} } } });
    }

    // 3) matching (exact/rule-based) + 4) duplicate detection (propose only)
    const groups = new Map<string, StagedItem[]>();
    for (const item of staged) {
      const key = slug(item.canonical.canonicalName) + '|' + slug(item.canonical.provinceCode);
      const arr = groups.get(key) ?? [];
      arr.push(item);
      groups.set(key, arr);
    }

    let proposedDrafts = 0;
    let matchedExisting = 0;
    let duplicatesPending = 0;

    for (const items of groups.values()) {
      // primary = highest source confidence; an explicit duplicate hint sinks it
      items.sort(
        (a, b) =>
          b.canonical.sourceConfidence - a.canonical.sourceConfidence ||
          (a.raw.duplicateCandidateOf ? 1 : 0) - (b.raw.duplicateCandidateOf ? 1 : 0),
      );
      const primary = items[0];
      const primaryKey = canonicalKeyForProject(primary.canonical);

      // rule-based EXACT match to an already-ACTIVE master → auto-link (strong:
      // canonical key + project type must both agree). Never merges fuzzily.
      const existing = await this.db.masterRecord.findFirst({
        where: { domain, status: 'ACTIVE', canonicalKey: primaryKey },
      });
      let primaryMaster;
      if (existing && slug((existing.canonicalFields as any)?.projectTypeCode) === slug(primary.canonical.projectTypeCode)) {
        primaryMaster = existing;
        await this.db.sourceRecord.update({
          where: { id: primary.srId },
          data: { matchStatus: 'matched', masterRecordId: existing.id, matchScore: 1 },
        });
        matchedExisting++;
      } else {
        // DRAFT proposal — ACTIVE only after human review + commit.
        primaryMaster = await this.db.masterRecord.create({
          data: {
            tenantId: primary.canonical.visibility === 'TENANT_PRIVATE' ? tenantId : null,
            domain,
            canonicalKey: primaryKey,
            canonicalFields: primary.canonical as any,
            aliases: this.buildAliases([primary]),
            visibility: primary.canonical.visibility,
            status: 'DRAFT',
            qualityScore: primary.canonical.sourceConfidence,
            version: 1,
          },
        });
        await this.db.sourceRecord.update({
          where: { id: primary.srId },
          data: { matchStatus: 'matched', masterRecordId: primaryMaster.id },
        });
        proposedDrafts++;
      }

      // the rest of the group are SUSPECTED duplicates → pending review, no merge
      for (const dup of items.slice(1)) {
        const score = duplicateScore(
          { canonical: dup.canonical, hint: !!dup.raw.duplicateCandidateOf },
          { canonical: primary.canonical },
        );
        await this.db.duplicatePair.create({
          data: {
            tenantId,
            sourceRecordId: dup.srId,
            candidateMasterId: primaryMaster.id,
            importJobId: job.id,
            score,
            reason: `same canonical name "${primary.canonical.canonicalName}" in ${primary.canonical.provinceCode ?? '?'}`,
            decision: 'pending',
          },
        });
        await this.db.sourceRecord.update({
          where: { id: dup.srId },
          data: { matchStatus: 'duplicate', matchScore: score },
        });
        duplicatesPending++;
      }
    }

    const counts = {
      staged: staged.length,
      proposedDrafts,
      matchedExisting,
      duplicatesPending,
      committed: 0,
    };
    const stage = duplicatesPending > 0 ? 'matched' : 'reviewed';
    const updated = await this.db.importJob.update({ where: { id: job.id }, data: { stage, counts } });
    return updated;
  }

  private buildAliases(items: { canonical: CanonicalProject }[]): string[] {
    const set = new Set<string>();
    for (const it of items) {
      if (it.canonical.canonicalName) set.add(it.canonical.canonicalName);
      for (const a of it.canonical.aliases) set.add(a);
    }
    return [...set];
  }

  getImportJob(tenantId: string, id: string) {
    return this.db.importJob.findFirst({ where: { id, tenantId } }).then((j) => {
      if (!j) throw new NotFoundException(`import job not found: ${id}`);
      return j;
    });
  }

  /**
   * Commit a reviewed import job: ACTIVATE its DRAFT masters. Refuses while any
   * duplicate pair for the job is still pending (human review is mandatory).
   */
  async commitJob(tenantId: string, id: string) {
    const job = await this.db.importJob.findFirst({ where: { id, tenantId } });
    if (!job) throw new NotFoundException(`import job not found: ${id}`);
    const pending = await this.db.duplicatePair.count({ where: { importJobId: id, decision: 'pending' } });
    if (pending > 0) {
      throw new BadRequestException(`resolve ${pending} pending duplicate(s) before commit`);
    }
    const srs = await this.db.sourceRecord.findMany({
      where: { importJobId: id, masterRecordId: { not: null } },
      select: { masterRecordId: true },
    });
    const masterIds = [...new Set(srs.map((s) => s.masterRecordId!).filter(Boolean))];
    let committed = 0;
    for (const mid of masterIds) {
      const m = await this.db.masterRecord.findUnique({ where: { id: mid } });
      if (m && m.status === 'DRAFT') {
        await this.db.masterRecord.update({ where: { id: mid }, data: { status: 'ACTIVE' } });
        committed++;
      }
    }
    const counts = { ...(job.counts as any), committed };
    return this.db.importJob.update({ where: { id }, data: { stage: 'committed', counts } });
  }

  // ==== duplicate review =====================================================

  listDuplicatePairs(tenantId: string, decision?: string) {
    return this.db.duplicatePair.findMany({
      where: { tenantId, ...(decision ? { decision } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Human resolution of a suspected duplicate. `merge` folds the incoming record
   * into the candidate master (aliases accumulate); `keep_separate` gives it its
   * own DRAFT master. Either way the decision is recorded with reviewer + time.
   */
  async resolveDuplicate(
    tenantId: string,
    pairId: string,
    decision: 'merge' | 'keep_separate',
    resolvedBy?: string,
  ) {
    if (decision !== 'merge' && decision !== 'keep_separate') {
      throw new BadRequestException('decision must be merge | keep_separate');
    }
    const pair = await this.db.duplicatePair.findFirst({ where: { id: pairId, tenantId } });
    if (!pair) throw new NotFoundException(`duplicate pair not found: ${pairId}`);
    if (pair.decision !== 'pending') {
      return { alreadyResolved: true, pair };
    }
    const sr = await this.db.sourceRecord.findFirst({ where: { id: pair.sourceRecordId, tenantId } });
    if (!sr) throw new NotFoundException('duplicate source record missing');
    const canonical = sr.normalized as any as CanonicalProject;

    let master;
    if (decision === 'merge') {
      master = await this.db.masterRecord.findUnique({ where: { id: pair.candidateMasterId! } });
      if (!master) throw new NotFoundException('candidate master missing');
      const aliases = new Set<string>([...master.aliases]);
      if (canonical?.canonicalName) aliases.add(canonical.canonicalName);
      for (const a of canonical?.aliases ?? []) aliases.add(a);
      master = await this.db.masterRecord.update({
        where: { id: master.id },
        data: { aliases: [...aliases] },
      });
      await this.db.sourceRecord.update({
        where: { id: sr.id },
        data: { matchStatus: 'matched', masterRecordId: master.id },
      });
    } else {
      master = await this.db.masterRecord.create({
        data: {
          tenantId: canonical?.visibility === 'TENANT_PRIVATE' ? tenantId : null,
          domain: sr.domain,
          canonicalKey: canonicalKeyForProject(canonical),
          canonicalFields: canonical as any,
          aliases: this.buildAliases([{ canonical }]),
          visibility: canonical?.visibility ?? 'SHARED_WITH_VISIBILITY',
          status: 'DRAFT',
          qualityScore: canonical?.sourceConfidence,
          version: 1,
        },
      });
      await this.db.sourceRecord.update({
        where: { id: sr.id },
        data: { matchStatus: 'matched', masterRecordId: master.id },
      });
    }

    const updatedPair = await this.db.duplicatePair.update({
      where: { id: pairId },
      data: { decision, resolvedBy, resolvedAt: new Date() },
    });

    // if the job has no more pending pairs, advance it to reviewed
    if (pair.importJobId) {
      const stillPending = await this.db.duplicatePair.count({
        where: { importJobId: pair.importJobId, decision: 'pending' },
      });
      if (stillPending === 0) {
        await this.db.importJob.updateMany({ where: { id: pair.importJobId }, data: { stage: 'reviewed' } });
      }
    }
    return { pair: updatedPair, master };
  }

  // ==== master records (shared/platform, code-filtered visibility) ===========

  async listMasterRecords(tenantId: string, opts: { domain?: string; q?: string; status?: string }) {
    const status = opts.status ?? 'ACTIVE';
    const rows = await this.db.masterRecord.findMany({
      where: {
        ...(opts.domain ? { domain: opts.domain } : {}),
        ...(status === 'all' ? {} : { status }),
        // shared (tenantId null) OR this tenant's private records
        OR: [{ tenantId: null }, { tenantId }],
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
    const q = opts.q?.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (m) =>
        (m.canonicalFields as any)?.canonicalName?.toLowerCase?.().includes(q) ||
        m.aliases.some((a) => a.toLowerCase().includes(q)),
    );
  }

  /** Master detail + lineage (RLS-scoped source records) + tenant overlay. */
  async getMasterRecord(tenantId: string, id: string) {
    const master = await this.db.masterRecord.findUnique({ where: { id } });
    if (!master) throw new NotFoundException(`master record not found: ${id}`);
    if (master.tenantId && master.tenantId !== tenantId) {
      throw new NotFoundException(`master record not found: ${id}`);
    }
    // lineage: source records are tenant-scoped by RLS → only this tenant's rows
    const sourceRecords = await this.db.sourceRecord.findMany({ where: { masterRecordId: id } });
    const overlay = await this.db.tenantMasterOverlay.findFirst({
      where: { tenantId, masterRecordId: id },
    });
    return { ...master, lineage: sourceRecords, overlay };
  }

  // ==== tenant overlays ======================================================

  listOverlays(tenantId: string, masterRecordId?: string) {
    return this.db.tenantMasterOverlay.findMany({
      where: { tenantId, ...(masterRecordId ? { masterRecordId } : {}) },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Upsert a tenant overlay on a shared master. NEVER touches the canonical
   * master. Overlay version bumps on each edit.
   */
  async putOverlay(
    tenantId: string,
    input: {
      masterRecordId: string;
      overlayFields?: Record<string, any>;
      privateTags?: string[];
      ownerUserId?: string | null;
      visibilityWithinTenant?: 'ALL' | 'SCOPED' | 'PRIVATE';
    },
  ) {
    const master = await this.db.masterRecord.findUnique({ where: { id: input.masterRecordId } });
    if (!master) throw new NotFoundException(`master record not found: ${input.masterRecordId}`);
    if (master.tenantId && master.tenantId !== tenantId) {
      throw new NotFoundException(`master record not found: ${input.masterRecordId}`);
    }
    const existing = await this.db.tenantMasterOverlay.findFirst({
      where: { tenantId, masterRecordId: input.masterRecordId },
    });
    if (existing) {
      return this.db.tenantMasterOverlay.update({
        where: { id: existing.id },
        data: {
          overlayFields: (input.overlayFields ?? existing.overlayFields) as any,
          privateTags: input.privateTags ?? existing.privateTags,
          ownerUserId: input.ownerUserId ?? existing.ownerUserId,
          visibilityWithinTenant: input.visibilityWithinTenant ?? existing.visibilityWithinTenant,
          version: existing.version + 1,
        },
      });
    }
    return this.db.tenantMasterOverlay.create({
      data: {
        tenantId,
        masterRecordId: input.masterRecordId,
        overlayFields: (input.overlayFields ?? {}) as any,
        privateTags: input.privateTags ?? [],
        ownerUserId: input.ownerUserId ?? null,
        visibilityWithinTenant: input.visibilityWithinTenant ?? 'ALL',
        version: 1,
      },
    });
  }

  // ==== seed (idempotent, deterministic, under RLS bypass) ===================

  private async seed(): Promise<void> {
    const dir = join(process.cwd(), 'seed-data', 'mdm');
    const sample = JSON.parse(readFileSync(join(dir, 'x2bms-project-import-sample.json'), 'utf8'));
    const XTECH = 'tenant-xtech';
    const DEMO = 'tenant-demo-isolation';

    await this.prisma.withBypass(async () => {
      // 1) Shared reference geography masters (GLOBAL, never per-tenant).
      const geos = [
        { id: 'geo-hanoi', name: 'Hà Nội', level: 'province' },
        { id: 'geo-namtuliem', name: 'Nam Từ Liêm', level: 'district' },
      ];
      for (const g of geos) {
        await this.db.masterRecord.upsert({
          where: { id: g.id },
          update: {},
          create: {
            id: g.id,
            tenantId: null,
            domain: 'GEOGRAPHY',
            canonicalKey: slug(g.name),
            canonicalFields: { canonicalName: g.name, level: g.level, countryCode: 'VN' },
            aliases: [g.name],
            visibility: 'GLOBAL',
            status: 'ACTIVE',
            version: 1,
          },
        });
      }

      // 2) Demo import job for tenant-xtech (idempotent) → DRAFT master + 1
      //    pending "X Riverside" duplicate pair (baseline; NOT committed).
      await this.runImport(XTECH, {
        sourceSystem: 'X2BMS',
        domain: 'PROJECT',
        records: sample,
        jobId: 'seed-mdm-job-xtech',
        createdBy: 'seed',
      });

      // 3) demo-isolation canary — a SourceRecord + ImportJob carrying a
      //    MUST_NOT_LEAK marker so the RLS test proves cross-tenant isolation
      //    on the new tenant-scoped MDM tables.
      await this.db.importJob.upsert({
        where: { id: 'seed-mdm-job-demo' },
        update: {},
        create: {
          id: 'seed-mdm-job-demo',
          tenantId: DEMO,
          sourceSystem: 'X2BMS',
          domain: 'PROJECT',
          stage: 'staging',
          counts: { marker: 'MUST_NOT_LEAK' },
          createdBy: 'seed',
        },
      });
      await this.db.sourceRecord.upsert({
        where: {
          tenantId_sourceSystem_sourceId: { tenantId: DEMO, sourceSystem: 'X2BMS', sourceId: 'X2P-DEMO-LEAK' },
        },
        update: {},
        create: {
          tenantId: DEMO,
          sourceSystem: 'X2BMS',
          sourceId: 'X2P-DEMO-LEAK',
          domain: 'PROJECT',
          raw: { marker: 'MUST_NOT_LEAK', rawName: 'MUST_NOT_LEAK canary' },
          matchStatus: 'unmatched',
          importJobId: 'seed-mdm-job-demo',
        },
      });
    });
  }
}
