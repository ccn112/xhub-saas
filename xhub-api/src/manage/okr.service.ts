import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OKR_CYCLE_STATUSES, OKR_OBJECTIVE_STATUSES } from './manage.constants';

/**
 * OKR (X.Office Management MG-03) — OKRCycle → OKRObjective → KeyResult →
 * KeyResultCheckIn (append-only). Mirrors contracts/okr.schema.json.
 *
 * Constitution #9 (KPI≠OKR≠task list): KeyResult.linkedActionIds REFERENCES
 * ActionCommitment.id (the same bridge MG-01 uses to reach NativeWorkItem) —
 * there is NO raw task list here; real work stays in NativeWorkItem/Work v2.
 * Check-ins are append-only: only create + list are exposed, no update/delete.
 */
@Injectable()
export class OkrService {
  constructor(private readonly prisma: PrismaService) {}
  private get db() {
    return this.prisma.db;
  }

  // ---- cycles ---------------------------------------------------------------

  async listCycles(tenantId: string) {
    const items = await this.db.oKRCycle.findMany({ where: { tenantId }, orderBy: [{ code: 'desc' }] });
    return { items, count: items.length };
  }

  async createCycle(tenantId: string, actorId: string, body: any) {
    if (!body?.code) throw new BadRequestException('code is required');
    if (!body?.name) throw new BadRequestException('name is required');
    if (!body?.startDate) throw new BadRequestException('startDate is required');
    if (!body?.endDate) throw new BadRequestException('endDate is required');
    const status = (body.status ?? 'PLANNING').toUpperCase();
    if (!OKR_CYCLE_STATUSES.includes(status)) throw new BadRequestException(`invalid status ${status}`);
    return this.db.oKRCycle.create({
      data: {
        tenantId,
        code: body.code,
        name: body.name,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        status,
        createdBy: actorId,
      },
    });
  }

  // ---- objectives + key results ----------------------------------------------

  async list(tenantId: string, filter: { cycleId?: string } = {}) {
    const items = await this.db.oKRObjective.findMany({
      where: { tenantId, ...(filter.cycleId ? { cycleId: filter.cycleId } : {}) },
      include: { keyResults: { include: { checkIns: { orderBy: [{ checkedAt: 'desc' }] } } } },
      orderBy: [{ createdAt: 'asc' }],
    });
    return { items, count: items.length };
  }

  async get(tenantId: string, id: string) {
    const obj = await this.db.oKRObjective.findFirst({
      where: { id, tenantId },
      include: { keyResults: { include: { checkIns: { orderBy: [{ checkedAt: 'desc' }] } } } },
    });
    if (!obj) throw new NotFoundException(`okr objective not found: ${id}`);
    return obj;
  }

  /** Validate + create an Objective with keyResults[] (contract requires ≥1). */
  async create(tenantId: string, actorId: string, body: any) {
    if (!body?.cycleId) throw new BadRequestException('cycleId is required');
    if (!body?.objective) throw new BadRequestException('objective is required');
    const cycle = await this.db.oKRCycle.findFirst({ where: { id: body.cycleId, tenantId } });
    if (!cycle) throw new BadRequestException(`unknown cycleId ${body.cycleId}`);
    const status = (body.status ?? 'DRAFT').toUpperCase();
    if (!OKR_OBJECTIVE_STATUSES.includes(status)) throw new BadRequestException(`invalid status ${status}`);
    const keyResults = Array.isArray(body.keyResults) ? body.keyResults : [];
    if (keyResults.length === 0) throw new BadRequestException('keyResults must have at least 1 item');
    for (const [i, kr] of keyResults.entries()) {
      if (!kr?.description) throw new BadRequestException(`keyResults[${i}].description is required`);
      if (kr?.baseline === undefined) throw new BadRequestException(`keyResults[${i}].baseline is required`);
      if (kr?.target === undefined) throw new BadRequestException(`keyResults[${i}].target is required`);
      if (!kr?.unit) throw new BadRequestException(`keyResults[${i}].unit is required`);
      if (kr?.nativeWorkItemId || kr?.taskId || kr?.tasks) {
        throw new BadRequestException('KeyResult must link Initiative/ActionCommitment, not a raw task list (#9)');
      }
    }

    const obj = await this.db.oKRObjective.create({
      data: {
        tenantId,
        cycleId: body.cycleId,
        objective: body.objective,
        ownerId: body.ownerId ?? actorId,
        status,
        confidence: body.confidence ?? null,
        strategicObjectiveIds: body.strategicObjectiveIds ?? [],
        createdBy: actorId,
        keyResults: {
          create: keyResults.map((kr: any) => ({
            tenantId,
            description: kr.description,
            baseline: kr.baseline,
            target: kr.target,
            current: kr.current ?? kr.baseline,
            unit: kr.unit,
            evidenceUrl: kr.evidenceUrl ?? null,
            linkedActionIds: Array.isArray(kr.linkedActionIds) ? kr.linkedActionIds : [],
            createdBy: actorId,
          })),
        },
      },
      include: { keyResults: { include: { checkIns: true } } },
    });
    return obj;
  }

  async update(tenantId: string, actorId: string, id: string, body: any) {
    const existing = await this.db.oKRObjective.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException(`okr objective not found: ${id}`);
    if (body.status) {
      const status = String(body.status).toUpperCase();
      if (!OKR_OBJECTIVE_STATUSES.includes(status as any)) throw new BadRequestException(`invalid status ${status}`);
      body.status = status;
    }
    if (body.confidence != null && (body.confidence < 0 || body.confidence > 1)) {
      throw new BadRequestException('confidence must be 0..1');
    }
    const obj = await this.db.oKRObjective.update({
      where: { id },
      data: {
        status: body.status ?? undefined,
        confidence: body.confidence ?? undefined,
        strategicObjectiveIds: body.strategicObjectiveIds ?? undefined,
      },
      include: { keyResults: { include: { checkIns: true } } },
    });
    return obj;
  }

  // ---- key result check-in (APPEND-ONLY) -------------------------------------

  /**
   * Append a check-in for a KeyResult and bump `current` to the check-in value
   * — the check-in ROW itself is never updated/deleted (history survives).
   */
  async checkIn(tenantId: string, actorId: string, objectiveId: string, keyResultId: string, body: any) {
    const kr = await this.db.keyResult.findFirst({ where: { id: keyResultId, tenantId, okrObjectiveId: objectiveId } });
    if (!kr) throw new NotFoundException(`key result not found: ${keyResultId}`);
    if (body?.value === undefined) throw new BadRequestException('value is required');
    if (body?.confidence != null && (body.confidence < 0 || body.confidence > 1)) {
      throw new BadRequestException('confidence must be 0..1');
    }
    const checkIn = await this.db.keyResultCheckIn.create({
      data: {
        tenantId,
        keyResultId,
        value: body.value,
        confidence: body.confidence ?? null,
        note: body.note ?? null,
        authorId: body.authorId ?? actorId,
        evidenceUrl: body.evidenceUrl ?? null,
      },
    });
    const updatedKr = await this.db.keyResult.update({
      where: { id: keyResultId },
      data: { current: body.value },
      include: { checkIns: { orderBy: [{ checkedAt: 'desc' }] } },
    });
    return { checkIn, keyResult: updatedKr };
  }
}
