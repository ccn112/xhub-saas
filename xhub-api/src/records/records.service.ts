import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from './storage.service';
import { SECRET_FIELD_REGEX, assertNoSecretFields } from '../common/document-guards';
import type { AddVersionDto, CreateDocumentDto } from './dto/document.dto';

/**
 * RecordsService — document model + immutable, append-only versioning (Mục 8a).
 *
 * Runs inside the caller's withTenant(tenantId) context (opened by
 * TenantScopeInterceptor) so every read/write is RLS-scoped to the caller's
 * tenant. A document has an ever-growing chain of DocumentVersion rows; existing
 * versions are NEVER mutated — adding content appends a new versionNo and moves
 * RecordDocument.currentVersionId. Content is stored by sha256 hash; identical
 * content (same document) is deduped to the prior version's storageKey.
 *
 * MUST_NOT_LEAK: metadata is secret-scanned (reusing the backup module's
 * SECRET_FIELD_REGEX / assertNoSecretFields) so no credential/secret field name
 * can be persisted onto a document.
 */
@Injectable()
export class RecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  private get db() {
    return this.prisma.db;
  }

  /** Reject secret-like metadata (field NAMES) before any write. */
  private guardMetadata(meta: Record<string, unknown>): void {
    assertNoSecretFields(meta);
    // Also reject secret-like values inside free-form tags (defense-in-depth).
    for (const t of (meta.tags as string[] | undefined) ?? []) {
      if (SECRET_FIELD_REGEX.test(String(t))) {
        throw new BadRequestException('MUST_NOT_LEAK: secret-like tag rejected');
      }
    }
  }

  private toBuffer(body: { content?: string; contentBase64?: string }): Buffer {
    if (body.contentBase64 != null) return Buffer.from(body.contentBase64, 'base64');
    if (body.content != null) return Buffer.from(body.content, 'utf8');
    throw new BadRequestException('content or contentBase64 is required');
  }

  // ---- create document (+ first version) -----------------------------------
  async createDocument(tenantId: string, actorId: string | undefined, body: CreateDocumentDto) {
    if (!body?.title) throw new BadRequestException('title is required');
    this.guardMetadata({
      kind: body.kind,
      title: body.title,
      subjectType: body.subjectType,
      subjectId: body.subjectId,
      tags: body.tags,
      mimeType: body.mimeType,
    });

    const doc = await this.db.recordDocument.create({
      data: {
        tenantId,
        kind: body.kind ?? 'GENERIC',
        title: body.title,
        ownerId: actorId ?? null,
        subjectType: body.subjectType ?? null,
        subjectId: body.subjectId ?? null,
        tags: body.tags ?? [],
      },
    });

    const version = await this.appendVersion(tenantId, actorId, doc.id, {
      mimeType: body.mimeType,
      content: body.content,
      contentBase64: body.contentBase64,
    });

    const withCurrent = await this.db.recordDocument.findUnique({ where: { id: doc.id } });
    return { document: withCurrent, version };
  }

  // ---- add version (append-only, immutable predecessors) -------------------
  async addVersion(tenantId: string, actorId: string | undefined, documentId: string, body: AddVersionDto) {
    const doc = await this.db.recordDocument.findFirst({ where: { id: documentId, tenantId } });
    if (!doc) throw new NotFoundException(`document not found: ${documentId}`);
    const version = await this.appendVersion(tenantId, actorId, documentId, body);
    return { document: await this.db.recordDocument.findUnique({ where: { id: documentId } }), version };
  }

  /**
   * Core append: compute the next versionNo, hash the content, dedup by hash
   * against existing versions of THIS document (reuse storageKey when identical),
   * write bytes for new content, persist an immutable DocumentVersion row, and
   * advance the document's currentVersionId.
   */
  private async appendVersion(
    tenantId: string,
    actorId: string | undefined,
    documentId: string,
    body: AddVersionDto,
  ) {
    const content = this.toBuffer(body);
    const contentHash = this.storage.sha256(content);
    const byteSize = content.length;

    const last = await this.db.documentVersion.findFirst({
      where: { tenantId, documentId },
      orderBy: { versionNo: 'desc' },
    });
    const versionNo = (last?.versionNo ?? 0) + 1;

    // Dedup: identical content already stored for this document → reuse its key.
    const dup = await this.db.documentVersion.findFirst({
      where: { tenantId, documentId, contentHash },
      orderBy: { versionNo: 'asc' },
    });

    let storageKey: string;
    let deduped = false;
    if (dup) {
      storageKey = dup.storageKey;
      deduped = true;
    } else {
      storageKey = this.storage.put(tenantId, documentId, versionNo, content).storageKey;
    }

    const version = await this.db.documentVersion.create({
      data: {
        tenantId,
        documentId,
        versionNo,
        contentHash,
        byteSize,
        mimeType: body.mimeType ?? 'application/octet-stream',
        storageKey,
        createdBy: actorId ?? null,
      },
    });

    await this.db.recordDocument.update({
      where: { id: documentId },
      data: { currentVersionId: version.id },
    });

    return { ...version, deduped };
  }

  // ---- reads ----------------------------------------------------------------
  async listDocuments(tenantId: string, opts?: { kind?: string; subjectType?: string; subjectId?: string }) {
    const docs = await this.db.recordDocument.findMany({
      where: {
        tenantId,
        ...(opts?.kind ? { kind: opts.kind } : {}),
        ...(opts?.subjectType ? { subjectType: opts.subjectType } : {}),
        ...(opts?.subjectId ? { subjectId: opts.subjectId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      // Enrich each row with the current version's size/no + total version count
      // so listing screens can show real "dung lượng" / "số phiên bản" without
      // N extra round-trips. Additive — original fields are preserved.
      include: {
        versions: { orderBy: { versionNo: 'desc' }, take: 1, select: { versionNo: true, byteSize: true, mimeType: true } },
        _count: { select: { versions: true } },
      },
    });
    return docs.map(({ versions, _count, ...doc }) => ({
      ...doc,
      versionCount: _count.versions,
      currentVersion: versions[0] ?? null,
      byteSize: versions[0]?.byteSize ?? 0,
    }));
  }

  async getDocument(tenantId: string, documentId: string) {
    const doc = await this.db.recordDocument.findFirst({ where: { id: documentId, tenantId } });
    if (!doc) throw new NotFoundException(`document not found: ${documentId}`);
    const versions = await this.db.documentVersion.findMany({
      where: { tenantId, documentId },
      orderBy: { versionNo: 'asc' },
    });
    return { document: doc, versions };
  }

  /** Return a version's stored content (base64) + its metadata. */
  async getVersionContent(tenantId: string, documentId: string, versionNo: number) {
    const version = await this.db.documentVersion.findFirst({
      where: { tenantId, documentId, versionNo },
    });
    if (!version) throw new NotFoundException(`version not found: ${documentId}#${versionNo}`);
    const bytes = this.storage.get(version.storageKey);
    return {
      documentId,
      versionNo,
      contentHash: version.contentHash,
      mimeType: version.mimeType,
      byteSize: version.byteSize,
      contentBase64: bytes.toString('base64'),
    };
  }
}
