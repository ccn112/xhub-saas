import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationView } from './xoffice.types';

export interface DispatchInput {
  tenantId: string;
  userId?: string | null;
  type: string;
  title: string;
  body?: string;
  sourceSystem?: string;
  sourceType?: string;
  sourceId?: string;
  deepLink?: string;
  channelHint?: 'in_app' | 'xspace_card';
}

/**
 * Notification dispatch + read-receipt store (operational layer).
 * 'xspace_card' is a MOCK hint only — no real Mattermost push is performed.
 * Every row is tenant + user scoped. Dispatch to an unmapped role queue
 * (no userId) is a no-op (nothing to notify).
 */
@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  private map(row: any): NotificationView {
    return {
      id: row.id,
      // Slug derives from the tenant id by stripping the `tenant-` prefix
      // (tenant-xtech → xtech). No X-TECH special case — the registry key IS the
      // prefix-stripped id, so the generic derivation is identical.
      tenantSlug: row.tenantId.replace(/^tenant-/, ''),
      userId: row.userId,
      type: row.type,
      title: row.title,
      body: row.body ?? null,
      sourceSystem: row.sourceSystem ?? null,
      sourceType: row.sourceType ?? null,
      sourceId: row.sourceId ?? null,
      deepLink: row.deepLink ?? null,
      channelHint: row.channelHint,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
      readAt: row.readAt instanceof Date ? row.readAt.toISOString() : (row.readAt ?? null),
    };
  }

  /** Create one in-app notification. Returns null when there is no user to notify. */
  async dispatch(input: DispatchInput): Promise<NotificationView | null> {
    const userId = input.userId?.trim();
    if (!userId) return null;
    const row = await this.prisma.db.notification.create({
      data: {
        tenantId: input.tenantId,
        userId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        sourceSystem: input.sourceSystem ?? null,
        sourceType: input.sourceType ?? null,
        sourceId: input.sourceId ?? null,
        deepLink: input.deepLink ?? null,
        channelHint: input.channelHint ?? 'in_app',
      },
    });
    return this.map(row);
  }

  async list(tenantId: string, userId: string): Promise<NotificationView[]> {
    const rows = await this.prisma.db.notification.findMany({
      where: { tenantId, userId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.map(r));
  }

  async unreadCount(tenantId: string, userId: string): Promise<number> {
    return this.prisma.db.notification.count({ where: { tenantId, userId, readAt: null } });
  }

  async markRead(tenantId: string, userId: string, id: string): Promise<NotificationView | null> {
    const row = await this.prisma.db.notification.findFirst({ where: { id, tenantId, userId } });
    if (!row) return null;
    if (row.readAt) return this.map(row);
    const updated = await this.prisma.db.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
    return this.map(updated);
  }

  async markAllRead(tenantId: string, userId: string): Promise<number> {
    const res = await this.prisma.db.notification.updateMany({
      where: { tenantId, userId, readAt: null },
      data: { readAt: new Date() },
    });
    return res.count;
  }
}
