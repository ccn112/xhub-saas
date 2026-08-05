import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertNoSecretValues } from '../common/document-guards';

function checkNoSecretValues(body: string): void {
  try {
    assertNoSecretValues(body);
  } catch (e) {
    throw new BadRequestException((e as Error).message);
  }
}

const DOCUMENT_TYPES = [
  'ARCHITECTURE', 'DOMAIN_SOR', 'API_EVENT', 'DATA_MIGRATION', 'SECURITY_PRIVACY',
  'DEV_GUIDE', 'TEST_ACCEPTANCE', 'OPERATIONS_RUNBOOK', 'USER_GUIDE', 'TRAINING',
  'RELEASE_NOTES', 'UPGRADE_ROLLBACK', 'OTHER',
];
const STATUSES = ['DRAFT', 'REVIEW', 'APPROVED', 'PUBLISHED', 'DEPRECATED', 'ARCHIVED'];
const CLASSIFICATIONS = ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'];

export interface CreateDocumentInput {
  productId: string;
  code: string;
  title: string;
  documentType?: string;
  classification?: string;
  body?: string;
  standardsRefs?: string[];
  ownerRole?: string;
  actorId?: string;
}

export interface UpdateDocumentInput {
  title?: string;
  body?: string;
  status?: string;
  standardsRefs?: string[];
  actorId?: string;
}

/**
 * Engineering-owned document catalog (DG-03-lite,
 * docs/implementation/engineering-hub/ADR_MODULE_OWNERSHIP.md). Platform-
 * wide, withBypass only. Every write runs the document body through
 * assertNoSecretValues (src/common/document-guards.ts) — a dev doc must
 * never carry a real secret value (matches the MUST_NOT_LEAK convention
 * already used by records/backup).
 */
@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  list(productId: string, documentType?: string) {
    return this.prisma.withBypass(() =>
      this.prisma.db.engineeringDocument.findMany({
        where: { productId, ...(documentType ? { documentType } : {}) },
        orderBy: { updatedAt: 'desc' },
      }),
    );
  }

  async get(idOrCode: string) {
    const doc = await this.prisma.withBypass(() =>
      this.prisma.db.engineeringDocument.findFirst({ where: { OR: [{ id: idOrCode }, { code: idOrCode }] } }),
    );
    if (!doc) throw new NotFoundException(`Unknown document: ${idOrCode}`);
    return doc;
  }

  async create(input: CreateDocumentInput) {
    if (!input.code?.trim()) throw new BadRequestException('code is required');
    if (!input.title?.trim()) throw new BadRequestException('title is required');
    const documentType = input.documentType ?? 'OTHER';
    if (!DOCUMENT_TYPES.includes(documentType)) {
      throw new BadRequestException(`documentType must be one of ${DOCUMENT_TYPES.join(', ')}`);
    }
    const classification = input.classification ?? 'INTERNAL';
    if (!CLASSIFICATIONS.includes(classification)) {
      throw new BadRequestException(`classification must be one of ${CLASSIFICATIONS.join(', ')}`);
    }
    if (input.body) checkNoSecretValues(input.body);
    const product = await this.prisma.withBypass(() =>
      this.prisma.db.product.findUnique({ where: { id: input.productId } }),
    );
    if (!product) throw new NotFoundException(`Unknown product: ${input.productId}`);
    const existing = await this.prisma.withBypass(() =>
      this.prisma.db.engineeringDocument.findUnique({ where: { code: input.code } }),
    );
    if (existing) throw new BadRequestException(`Document code already exists: ${input.code}`);
    return this.prisma.withBypass(() =>
      this.prisma.db.engineeringDocument.create({
        data: {
          productId: input.productId,
          code: input.code,
          title: input.title,
          documentType,
          classification,
          body: input.body,
          standardsRefs: input.standardsRefs ?? [],
          ownerRole: input.ownerRole,
          createdBy: input.actorId,
          updatedBy: input.actorId,
        },
      }),
    );
  }

  /** Edit bumps `version` by 1 — no separate DocumentVersion history table yet (see model docblock). */
  async update(id: string, input: UpdateDocumentInput) {
    const doc = await this.prisma.withBypass(() => this.prisma.db.engineeringDocument.findUnique({ where: { id } }));
    if (!doc) throw new NotFoundException(`Unknown document: ${id}`);
    if (input.status && !STATUSES.includes(input.status)) {
      throw new BadRequestException(`status must be one of ${STATUSES.join(', ')}`);
    }
    if (input.body) checkNoSecretValues(input.body);
    return this.prisma.withBypass(() =>
      this.prisma.db.engineeringDocument.update({
        where: { id },
        data: {
          ...(input.title ? { title: input.title } : {}),
          ...(input.body !== undefined ? { body: input.body, version: { increment: 1 } } : {}),
          ...(input.status ? { status: input.status } : {}),
          ...(input.standardsRefs ? { standardsRefs: input.standardsRefs } : {}),
          updatedBy: input.actorId,
        },
      }),
    );
  }
}
