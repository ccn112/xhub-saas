import { Body, Controller, Get, Param, Post, Put, Query, UseInterceptors } from '@nestjs/common';
import { MdmService } from './mdm.service';
import { Identity } from '../auth/identity.decorator';
import type { RequestIdentity } from '../auth/identity.types';
import { TenantScopeInterceptor } from '../common/tenant-scope.interceptor';

/**
 * Shared Master Data Hub (MDM) API. Tenant-scoped: TenantScopeInterceptor wraps
 * every handler in prisma.withTenant(identity.tenantId), so the tenant-scoped
 * tables (SourceRecord / ImportJob / DuplicatePair / TenantMasterOverlay) are
 * RLS-scoped. MasterRecord is the shared platform canonical — its visibility is
 * filtered in the service by tenantId + visibility (never per-tenant duplicated).
 */
@Controller('api/mdm')
@UseInterceptors(TenantScopeInterceptor)
export class MdmController {
  constructor(private readonly mdm: MdmService) {}

  // ---- ingestion -----------------------------------------------------------
  @Post('import-jobs')
  createImportJob(
    @Body()
    body: { sourceSystem?: string; domain?: string; records?: Record<string, any>[] },
    @Identity() id: RequestIdentity,
  ) {
    return this.mdm.runImport(id.tenantId, {
      sourceSystem: body.sourceSystem ?? 'X2BMS',
      domain: body.domain,
      records: body.records ?? this.loadSample(),
      createdBy: id.userId,
    });
  }

  /** Fallback sample loader (handoff seed) when no records are posted. */
  private loadSample(): Record<string, any>[] {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { readFileSync } = require('node:fs');
    const { join } = require('node:path');
    return JSON.parse(
      readFileSync(join(process.cwd(), 'seed-data', 'mdm', 'x2bms-project-import-sample.json'), 'utf8'),
    );
  }

  @Get('import-jobs/:id')
  getImportJob(@Param('id') jobId: string, @Identity() id: RequestIdentity) {
    return this.mdm.getImportJob(id.tenantId, jobId);
  }

  @Post('import-jobs/:id/commit')
  commit(@Param('id') jobId: string, @Identity() id: RequestIdentity) {
    return this.mdm.commitJob(id.tenantId, jobId);
  }

  // ---- master records ------------------------------------------------------
  @Get('master-records')
  listMasters(
    @Query('domain') domain: string,
    @Query('q') q: string,
    @Query('status') status: string,
    @Identity() id: RequestIdentity,
  ) {
    return this.mdm.listMasterRecords(id.tenantId, {
      domain: domain || undefined,
      q: q || undefined,
      status: status || undefined,
    });
  }

  @Get('master-records/:id')
  getMaster(@Param('id') masterId: string, @Identity() id: RequestIdentity) {
    return this.mdm.getMasterRecord(id.tenantId, masterId);
  }

  // ---- duplicate review ----------------------------------------------------
  @Get('duplicate-pairs')
  listDuplicates(@Query('decision') decision: string, @Identity() id: RequestIdentity) {
    return this.mdm.listDuplicatePairs(id.tenantId, decision || undefined);
  }

  @Post('duplicate-pairs/:id/resolve')
  resolveDuplicate(
    @Param('id') pairId: string,
    @Body() body: { decision: 'merge' | 'keep_separate' },
    @Identity() id: RequestIdentity,
  ) {
    return this.mdm.resolveDuplicate(id.tenantId, pairId, body.decision, id.userId);
  }

  // ---- tenant overlays -----------------------------------------------------
  @Get('tenant-overlays')
  listOverlays(@Query('masterRecordId') masterRecordId: string, @Identity() id: RequestIdentity) {
    return this.mdm.listOverlays(id.tenantId, masterRecordId || undefined);
  }

  @Put('tenant-overlays')
  putOverlay(
    @Body()
    body: {
      masterRecordId: string;
      overlayFields?: Record<string, any>;
      privateTags?: string[];
      ownerUserId?: string | null;
      visibilityWithinTenant?: 'ALL' | 'SCOPED' | 'PRIVATE';
    },
    @Identity() id: RequestIdentity,
  ) {
    return this.mdm.putOverlay(id.tenantId, body);
  }
}
