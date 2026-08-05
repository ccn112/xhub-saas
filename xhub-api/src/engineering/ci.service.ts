import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const STATUSES = ['QUEUED', 'RUNNING', 'SUCCESS', 'FAILURE', 'CANCELLED'];

export interface CiCallbackInput {
  productCode: string;
  source: string;
  externalId: string;
  commitSha: string;
  branch?: string;
  status: string;
  workflowRunUrl?: string;
  triggeredBy?: string;
  startedAt?: string;
  finishedAt?: string;
  metadata?: Record<string, unknown>;
}

/**
 * CI/build ingestion (DG-06). Platform-wide, withBypass only. The HMAC
 * signature check (the actual security boundary — see CiController) happens
 * before this service is ever called; this class only validates the body
 * shape and upserts. Unlike TestResultsService (append-only), a BuildRecord
 * is upserted in place keyed by (productId, source, externalId) — the same
 * CI run posts QUEUED, then RUNNING, then SUCCESS/FAILURE against the same
 * externalId, and each call just advances that one run's current state.
 */
@Injectable()
export class CiService {
  constructor(private readonly prisma: PrismaService) {}

  async recordBuild(input: CiCallbackInput) {
    if (!input.productCode?.trim()) throw new BadRequestException('productCode is required');
    if (!input.source?.trim()) throw new BadRequestException('source is required');
    if (!input.externalId?.trim()) throw new BadRequestException('externalId is required');
    if (!input.commitSha?.trim()) throw new BadRequestException('commitSha is required');
    if (!STATUSES.includes(input.status)) {
      throw new BadRequestException(`status must be one of ${STATUSES.join(', ')}`);
    }
    const product = await this.prisma.withBypass(() =>
      this.prisma.db.product.findUnique({ where: { code: input.productCode } }),
    );
    if (!product) throw new NotFoundException(`Unknown product code: ${input.productCode}`);

    const data = {
      commitSha: input.commitSha,
      branch: input.branch,
      status: input.status,
      workflowRunUrl: input.workflowRunUrl,
      triggeredBy: input.triggeredBy,
      startedAt: input.startedAt ? new Date(input.startedAt) : undefined,
      finishedAt: input.finishedAt ? new Date(input.finishedAt) : undefined,
      metadata: input.metadata as any,
    };

    return this.prisma.withBypass(() =>
      this.prisma.db.buildRecord.upsert({
        where: {
          productId_source_externalId: { productId: product.id, source: input.source, externalId: input.externalId },
        },
        create: { productId: product.id, source: input.source, externalId: input.externalId, ...data },
        update: data,
      }),
    );
  }

  list(productId: string, filters: { status?: string; source?: string } = {}) {
    return this.prisma.withBypass(() =>
      this.prisma.db.buildRecord.findMany({
        where: {
          productId,
          ...(filters.status ? { status: filters.status } : {}),
          ...(filters.source ? { source: filters.source } : {}),
        },
        orderBy: { updatedAt: 'desc' },
        take: 50,
      }),
    );
  }
}
