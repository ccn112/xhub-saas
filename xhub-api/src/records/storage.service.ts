import { Injectable } from '@nestjs/common';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

/**
 * StorageService — object-storage abstraction for document content (Mục 8a).
 *
 * Mirrors the backup module's storage layout: a folder-per-tenant tree rooted at
 * `storage/documents/<tenantId>/<documentId>/<versionNo>`. The default backend
 * is the local filesystem; the base dir is ENV-overridable
 * (DOCUMENTS_STORAGE_DIR) and the interface is deliberately S3-shaped
 * (put/get/exists by key) so a future S3 backend can drop in without touching
 * callers.
 *
 * Content is stored by hash: identical bytes produce the same sha256, and the
 * caller (RecordsService) reuses a prior version's storageKey when the hash
 * matches (dedup) rather than writing the bytes again.
 */
@Injectable()
export class StorageService {
  private baseDir(): string {
    return (
      process.env.DOCUMENTS_STORAGE_DIR ?? join(process.cwd(), 'storage', 'documents')
    );
  }

  /** Deterministic storage key for a version (relative, POSIX-style). */
  storageKey(tenantId: string, documentId: string, versionNo: number): string {
    return `storage/documents/${tenantId}/${documentId}/${versionNo}`;
  }

  private absPath(key: string): string {
    // key is `storage/documents/...`; strip the leading `storage/` segment since
    // baseDir already ends at `.../storage/documents`.
    const rel = key.replace(/^storage\/documents\//, '');
    return join(this.baseDir(), rel);
  }

  sha256(content: Buffer): string {
    return createHash('sha256').update(content).digest('hex');
  }

  exists(key: string): boolean {
    return existsSync(this.absPath(key));
  }

  /** Write bytes at the versioned key. Returns { storageKey, byteSize }. */
  put(tenantId: string, documentId: string, versionNo: number, content: Buffer) {
    const key = this.storageKey(tenantId, documentId, versionNo);
    const abs = this.absPath(key);
    mkdirSync(join(abs, '..'), { recursive: true });
    writeFileSync(abs, content);
    return { storageKey: key, byteSize: content.length };
  }

  /** Read the bytes stored at a key (throws if missing). */
  get(key: string): Buffer {
    return readFileSync(this.absPath(key));
  }
}
