import { Body, Controller, Get, Param, Post, UseInterceptors } from '@nestjs/common';
import { BackupService } from './backup.service';
import { RequirePermission } from '../auth/require-permission.decorator';
import { Identity } from '../auth/identity.decorator';
import type { RequestIdentity } from '../auth/identity.types';
import { TenantScopeInterceptor } from '../xoffice/tenant-scope.interceptor';
import type { RestoreRequestDto } from './dto/restore.dto';

/**
 * Per-tenant logical Backup / Restore API (Mục 6). Tenant-scoped:
 * TenantScopeInterceptor wraps each handler in prisma.withTenant(tenantId) so
 * BackupJob / RestoreJob reads + writes are RLS-scoped to the caller's tenant —
 * a tenant can never see another tenant's backup jobs.
 *
 * EXCEPTION: `restore` is skipped by the interceptor (SKIP_HANDLERS) because it
 * is cross-tenant by design (source read → sandbox write); the service manages
 * its own withBypass + explicit tenant scoping.
 *
 * Static routes (`restores`) are declared BEFORE the `:id` param route so Nest
 * matches them first.
 */
@Controller('api/backup')
@UseInterceptors(TenantScopeInterceptor)
export class BackupController {
  constructor(private readonly backup: BackupService) {}

  @Post()
  @RequirePermission('backup.manage')
  create(@Identity() id: RequestIdentity) {
    return this.backup.createBackup(id.tenantId, id.userId);
  }

  @Get()
  list(@Identity() id: RequestIdentity) {
    return this.backup.listBackups(id.tenantId);
  }

  @Get('restores')
  listRestores(@Identity() id: RequestIdentity) {
    return this.backup.listRestores(id.tenantId);
  }

  @Get(':id')
  get(@Param('id') backupId: string, @Identity() id: RequestIdentity) {
    return this.backup.getBackup(id.tenantId, backupId);
  }

  @Get(':id/verify')
  verify(@Param('id') backupId: string, @Identity() id: RequestIdentity) {
    return this.backup.verifyBackup(id.tenantId, backupId);
  }

  @Post(':id/restore')
  @RequirePermission('backup.manage')
  restore(
    @Param('id') backupId: string,
    @Body() body: RestoreRequestDto,
    @Identity() id: RequestIdentity,
  ) {
    return this.backup.restore(id.tenantId, backupId, {
      mode: body?.mode ?? 'dry-run',
      targetTenantId: body?.targetTenantId,
      tamper: body?.tamper,
    });
  }
}
