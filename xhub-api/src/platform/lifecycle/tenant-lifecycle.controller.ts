import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { RequirePermission } from '../../auth/require-permission.decorator';
import { Identity } from '../../auth/identity.decorator';
import type { RequestIdentity } from '../../auth/identity.types';
import { BackupService } from '../../backup/backup.service';
import { TenantGoLiveService } from './tenant-golive.service';
import { TenantRegistryService } from '../tenant-registry.service';

/**
 * Tenant Lifecycle API — DEMO reset + Go-Live checklist (Platform Console).
 * Platform plane: NO TenantScopeInterceptor (cross-tenant metadata + guarded
 * per-tenant restore/clear via withBypass inside the services). Gated by
 * `platform.tenant.manage` (PLATFORM_ADMIN `["*"]` wildcard satisfies it).
 *
 * Routes live under /api/platform/tenants/:id/... — declared here as a SEPARATE
 * controller from PlatformController; the sub-paths are more specific than that
 * controller's `:idOrCode` so Nest routing does not conflict.
 */
@Controller('api/platform/tenants')
export class TenantLifecycleController {
  constructor(
    private readonly backup: BackupService,
    private readonly golive: TenantGoLiveService,
    private readonly registry: TenantRegistryService,
  ) {}

  /** RESET-DEMO — restore DEMO_BASELINE in-place (DEMO-only else 409/400). */
  @Post(':id/reset-demo')
  @RequirePermission('platform.tenant.manage')
  async resetDemo(@Param('id') idOrCode: string, @Identity() ident: RequestIdentity) {
    const tenant = await this.registry.getById(idOrCode);
    return this.backup.resetToBaseline(tenant.id, ident.userId);
  }

  /** Ensure the immutable DEMO_BASELINE snapshot for a tenant (idempotent). */
  @Post(':id/demo-baseline')
  @RequirePermission('platform.tenant.manage')
  async ensureBaseline(@Param('id') idOrCode: string, @Identity() ident: RequestIdentity) {
    const tenant = await this.registry.getById(idOrCode);
    return this.backup.ensureDemoBaseline(tenant.id, ident.userId);
  }

  // ---- Go-Live checklist ----------------------------------------------------

  @Get(':id/go-live')
  @RequirePermission('platform.tenant.read')
  getGoLive(@Param('id') idOrCode: string) {
    return this.golive.getProgress(idOrCode);
  }

  @Post(':id/go-live')
  @RequirePermission('platform.tenant.manage')
  createGoLive(@Param('id') idOrCode: string, @Identity() ident: RequestIdentity) {
    return this.golive.createProgress(idOrCode, ident.userId);
  }

  @Patch(':id/go-live/steps/:key')
  @RequirePermission('platform.tenant.manage')
  patchStep(
    @Param('id') idOrCode: string,
    @Param('key') key: string,
    @Body() body: { status?: string; assigneeId?: string; note?: string },
    @Identity() ident: RequestIdentity,
  ) {
    return this.golive.patchStep(idOrCode, key, body ?? {}, ident.userId);
  }

  @Post(':id/go-live/activate')
  @RequirePermission('platform.tenant.manage')
  activate(
    @Param('id') idOrCode: string,
    @Body() body: { clearAll?: boolean },
    @Identity() ident: RequestIdentity,
  ) {
    return this.golive.activate(idOrCode, { clearAll: body?.clearAll }, ident.userId);
  }
}
