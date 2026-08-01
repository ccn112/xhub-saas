import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RecordsService } from '../records/records.service';
import { TenantLaunchService } from '../platform/launch/tenant-launch.service';
import {
  EngagementAction,
  engagementLegalActions,
  engagementNext,
  ENGAGEMENT_TRANSITIONS,
  isLaunchReady,
  STAGE_ORDER,
  statusForStage,
} from './engagements.fsm';

const SUBJECT_TYPE = 'Engagement';

/**
 * EngagementsService — the Solution Delivery Workspace (SaaS step 5). An
 * Engagement is one customer-delivery project of X-TECH (T001), tenant-scoped
 * under T001 (RLS). It orchestrates the delivery lifecycle over the EXISTING
 * module primitives (no new engine) and, at GO_LIVE, provisions the customer
 * tenant by REUSING the Tenant Launch Factory (TenantLaunchService) — it stores
 * only the resulting launchId and NEVER writes the customer tenant's business
 * rows (non-negotiable #12, no dual-write). Every transition writes an
 * EngagementEvent + AuditLog. Attachments reuse RecordDocument
 * (subjectType='Engagement'). Most methods run inside the caller's
 * withTenant(tenantId) (TenantScopeInterceptor); launchTenant is SKIPPED by that
 * interceptor and manages its own contexts so the launch factory's own
 * withBypass/withTenant are real (not neutered by a re-entrant outer context).
 */
@Injectable()
export class EngagementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly records: RecordsService,
    private readonly launch: TenantLaunchService,
  ) {}

  private get db() {
    return this.prisma.db;
  }

  // ---- events + audit -------------------------------------------------------
  private async event(
    tenantId: string,
    engagementId: string,
    type: string,
    actorId: string,
    data: Record<string, unknown> = {},
  ) {
    await this.db.engagementEvent.create({ data: { tenantId, engagementId, type, actorId, data: data as any } });
    await this.db.auditLog.create({
      data: {
        tenantId,
        instanceCode: engagementId,
        actorId,
        action: `engagement.${type}`,
        detail: JSON.stringify(data).slice(0, 500),
        at: new Date(),
      },
    });
  }

  private assertLegal(action: EngagementAction, from: string): string {
    const to = engagementNext(action, from);
    if (!to) {
      throw new BadRequestException(
        `Illegal engagement transition '${action}' from stage '${from}' (legal from: ${ENGAGEMENT_TRANSITIONS[action]?.from.join(', ') ?? '—'})`,
      );
    }
    return to;
  }

  private decorate(e: any) {
    return {
      ...e,
      legalActions: e.status === 'ON_HOLD' ? [] : engagementLegalActions(e.stage),
      launchReady: isLaunchReady(e.stage) && !e.launchId,
      onHold: e.status === 'ON_HOLD',
    };
  }

  private async load(tenantId: string, id: string) {
    const e = await this.db.engagement.findFirst({ where: { id, tenantId } });
    if (!e) throw new NotFoundException(`engagement not found: ${id}`);
    return e;
  }

  // ==== create ===============================================================
  async create(
    tenantId: string,
    actorId: string,
    body: {
      customerName: string;
      code?: string;
      industry?: string;
      prospectTenantNo?: number;
      targetTenantId?: string;
      blueprintCode?: string;
      seedPackCode?: string;
      ownerId?: string;
      value?: number;
      notes?: string;
    },
  ) {
    if (!body?.customerName) throw new BadRequestException('customerName is required');
    const code =
      body.code ?? `ENG-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    const engagement = await this.db.engagement.create({
      data: {
        tenantId,
        code,
        customerName: body.customerName,
        industry: body.industry ?? null,
        prospectTenantNo: Number.isFinite(body.prospectTenantNo as number) ? Number(body.prospectTenantNo) : null,
        targetTenantId: body.targetTenantId ?? null,
        blueprintCode: body.blueprintCode ?? null,
        seedPackCode: body.seedPackCode ?? null,
        stage: 'LEAD',
        status: 'OPEN',
        ownerId: body.ownerId ?? actorId,
        value: Number.isFinite(body.value as number) ? Number(body.value) : null,
        notes: body.notes ?? null,
      },
    });
    await this.event(tenantId, engagement.id, 'created', actorId, { code, stage: 'LEAD', customerName: body.customerName });
    return this.decorate(engagement);
  }

  // ==== list =================================================================
  async list(
    tenantId: string,
    filters?: { stage?: string; status?: string; ownerId?: string; q?: string; page?: number; pageSize?: number },
  ) {
    const where: any = { tenantId };
    if (filters?.stage) where.stage = filters.stage;
    if (filters?.status) where.status = filters.status;
    if (filters?.ownerId) where.ownerId = filters.ownerId;
    if (filters?.q) where.customerName = { contains: filters.q, mode: 'insensitive' };

    const rows = await this.db.engagement.findMany({ where, orderBy: { createdAt: 'desc' } });
    const enriched = rows.map((r) => this.decorate(r));
    const page = Math.max(1, filters?.page ?? 1);
    const pageSize = Math.max(1, Math.min(100, filters?.pageSize ?? 20));
    const total = enriched.length;
    const items = enriched.slice((page - 1) * pageSize, page * pageSize);
    return { items, total, page, pageSize };
  }

  // ==== pipeline overview (KPIs by stage/status) =============================
  async pipeline(tenantId: string) {
    const rows = await this.db.engagement.findMany({ where: { tenantId } });
    const byStage: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    let pipelineValue = 0;
    let wonValue = 0;
    for (const r of rows) {
      byStage[r.stage] = (byStage[r.stage] ?? 0) + 1;
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
      if (r.value) {
        if (r.status === 'OPEN') pipelineValue += r.value;
        if (['WON', 'LIVE'].includes(r.status)) wonValue += r.value;
      }
    }
    return {
      total: rows.length,
      stageOrder: STAGE_ORDER,
      byStage,
      byStatus,
      pipelineValue,
      wonValue,
      launchReady: rows.filter((r) => isLaunchReady(r.stage) && !r.launchId).length,
      launched: rows.filter((r) => !!r.launchId).length,
    };
  }

  // ==== detail (timeline + attachments + linked launch) ======================
  async get(tenantId: string, id: string) {
    const engagement = await this.load(tenantId, id);
    const [events, attachments] = await Promise.all([
      this.db.engagementEvent.findMany({ where: { tenantId, engagementId: id }, orderBy: { createdAt: 'asc' } }),
      this.records.listDocuments(tenantId, { subjectType: SUBJECT_TYPE, subjectId: id }),
    ]);
    // Linked launch progress is read OUTSIDE the tenant scope on purpose — the
    // launch lives on the platform plane. We only READ it (no dual-write).
    let launch: any = null;
    if (engagement.launchId) {
      launch = await this.launch.detail(engagement.launchId).catch(() => null);
    }
    return { engagement: this.decorate(engagement), events, attachments, launch };
  }

  // ==== transitions ==========================================================
  async transition(tenantId: string, actorId: string, id: string, action: EngagementAction, opts: { note?: string } = {}) {
    const e = await this.load(tenantId, id);
    if (e.status === 'ON_HOLD') {
      throw new BadRequestException(`engagement is ON_HOLD — resume before '${action}'`);
    }
    const to = this.assertLegal(action, e.stage);
    const updated = await this.db.engagement.update({
      where: { id },
      data: { stage: to, status: statusForStage(to) },
    });
    await this.event(tenantId, id, action, actorId, { from: e.stage, to, note: opts.note ?? null });
    return { engagement: this.decorate(updated) };
  }

  async hold(tenantId: string, actorId: string, id: string, opts: { note?: string } = {}) {
    const e = await this.load(tenantId, id);
    if (e.status === 'ON_HOLD') throw new BadRequestException('already ON_HOLD');
    if (['LOST', 'CUSTOMER_SUCCESS'].includes(e.stage)) throw new BadRequestException(`cannot hold a terminal engagement (stage=${e.stage})`);
    const updated = await this.db.engagement.update({ where: { id }, data: { status: 'ON_HOLD' } });
    await this.event(tenantId, id, 'hold', actorId, { stage: e.stage, note: opts.note ?? null });
    return { engagement: this.decorate(updated) };
  }

  async resume(tenantId: string, actorId: string, id: string, opts: { note?: string } = {}) {
    const e = await this.load(tenantId, id);
    if (e.status !== 'ON_HOLD') throw new BadRequestException(`not ON_HOLD (status=${e.status})`);
    const updated = await this.db.engagement.update({ where: { id }, data: { status: statusForStage(e.stage) } });
    await this.event(tenantId, id, 'resume', actorId, { stage: e.stage, note: opts.note ?? null });
    return { engagement: this.decorate(updated) };
  }

  // ==== comment ==============================================================
  async comment(tenantId: string, actorId: string, id: string, body: { body?: string; note?: string }) {
    await this.load(tenantId, id);
    const text = body.body ?? body.note;
    if (!text) throw new BadRequestException('comment body is required');
    await this.event(tenantId, id, 'comment', actorId, { body: text });
    return { ok: true };
  }

  // ==== attachment (RecordDocument subjectType=Engagement) ===================
  async attachment(
    tenantId: string,
    actorId: string,
    id: string,
    body: { title?: string; note?: string; content?: string; contentBase64?: string; mimeType?: string },
  ) {
    const e = await this.load(tenantId, id);
    const content = body.content ?? `Attachment for ${e.code}: ${body.note ?? 'engagement attachment'}`;
    const doc = await this.records.createDocument(tenantId, actorId, {
      kind: 'ATTACHMENT',
      title: body.title ?? `Attachment — ${e.code}`,
      subjectType: SUBJECT_TYPE,
      subjectId: id,
      tags: ['attachment', 'engagement'],
      ...(body.contentBase64 ? { contentBase64: body.contentBase64 } : { content }),
      mimeType: body.mimeType ?? 'text/plain',
    } as any);
    await this.event(tenantId, id, 'attachment', actorId, { documentId: doc.document?.id, title: doc.document?.title });
    return doc;
  }

  // ==== launch link (non-negotiable #12) =====================================
  /**
   * "Khởi chạy tenant khách" — at/after GO_LIVE, T001 provisions the customer
   * tenant by triggering a real TenantLaunch (Launch Factory). NO dual-write:
   * this method does NOT write the customer tenant's business rows — the launch
   * factory does, under the TARGET tenant's own context. The engagement only
   * stores the launchId and reads launch progress.
   *
   * This handler is SKIPPED by TenantScopeInterceptor, so it runs with NO
   * enclosing context: the engagement reads/writes open their own
   * withTenant(tenantId), and launch.create/run run on the platform plane with
   * their own real withBypass/withTenant.
   */
  async launchTenant(
    tenantId: string,
    actorId: string,
    id: string,
    body: {
      targetTenantId?: string;
      targetTenantNo?: number;
      blueprintCode?: string;
      seedPackCode?: string;
      name?: string;
      tenantClass?: string;
      request?: Record<string, any>;
    } = {},
  ) {
    const e = await this.prisma.withTenant(tenantId, () => this.load(tenantId, id));
    if (!isLaunchReady(e.stage)) {
      throw new BadRequestException(`launch allowed only at/after GO_LIVE (stage=${e.stage})`);
    }
    if (e.launchId) {
      throw new BadRequestException(`engagement already launched (launchId=${e.launchId})`);
    }
    const targetTenantId = body.targetTenantId ?? e.targetTenantId;
    if (!targetTenantId) {
      throw new BadRequestException('targetTenantId is required (engagement.targetTenantId or body.targetTenantId)');
    }

    // Trigger the REAL launch factory (platform plane) — reuse, no new engine.
    const created = await this.launch.create({
      targetTenantId,
      targetTenantNo: body.targetTenantNo ?? e.prospectTenantNo ?? null,
      blueprintId: body.blueprintCode ?? e.blueprintCode ?? null,
      seedPackId: body.seedPackCode ?? e.seedPackCode ?? null,
      name: body.name ?? e.customerName,
      tenantClass: body.tenantClass ?? 'CUSTOMER',
      tenantKey: targetTenantId,
      request: body.request ?? {},
      createdBy: actorId,
    });
    const ran = await this.launch.run(created.id);

    // Record the reference on the engagement (tenant-scoped write) — reference
    // only, never the customer tenant's business data.
    const updated = await this.prisma.withTenant(tenantId, async () => {
      const u = await this.db.engagement.update({
        where: { id },
        data: { launchId: ran.id, targetTenantId },
      });
      await this.event(tenantId, id, 'launch-triggered', actorId, {
        launchId: ran.id,
        targetTenantId,
        launchStatus: ran.status,
        blueprintId: ran.blueprintId,
        seedPackId: ran.seedPackId,
      });
      return u;
    });

    return { engagement: this.decorate(updated), launch: ran };
  }
}
