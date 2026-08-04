import { Body, Controller, Get, Param, Post, Query, UseInterceptors } from '@nestjs/common';
import { RecordsService } from './records.service';
import { RequirePermission } from '../auth/require-permission.decorator';
import { Identity } from '../auth/identity.decorator';
import type { RequestIdentity } from '../auth/identity.types';
import { XofficeTenantScopeInterceptor } from '../common/xoffice-tenant-scope.interceptor';
import type { AddVersionDto, CreateDocumentDto } from './dto/document.dto';

/**
 * Records / Documents API (Mục 8a). Tenant-scoped: XofficeTenantScopeInterceptor
 * wraps each handler in prisma.withTenant(tenantId) so every read/write is
 * RLS-scoped — on the X.Office database (Phase 1.5 Stage C).
 */
@Controller('api/records')
@UseInterceptors(XofficeTenantScopeInterceptor)
export class RecordsController {
  constructor(private readonly records: RecordsService) {}

  @Post()
  @RequirePermission('records.manage')
  create(@Body() body: CreateDocumentDto, @Identity() id: RequestIdentity) {
    return this.records.createDocument(id.tenantId, id.userId, body);
  }

  @Get()
  list(
    @Query('kind') kind: string,
    @Query('subjectType') subjectType: string,
    @Query('subjectId') subjectId: string,
    @Identity() id: RequestIdentity,
  ) {
    return this.records.listDocuments(id.tenantId, {
      kind: kind || undefined,
      subjectType: subjectType || undefined,
      subjectId: subjectId || undefined,
    });
  }

  @Get(':id')
  get(@Param('id') documentId: string, @Identity() id: RequestIdentity) {
    return this.records.getDocument(id.tenantId, documentId);
  }

  @Post(':id/versions')
  @RequirePermission('records.manage')
  addVersion(
    @Param('id') documentId: string,
    @Body() body: AddVersionDto,
    @Identity() id: RequestIdentity,
  ) {
    return this.records.addVersion(id.tenantId, id.userId, documentId, body);
  }

  @Get(':id/versions/:versionNo/content')
  versionContent(
    @Param('id') documentId: string,
    @Param('versionNo') versionNo: string,
    @Identity() id: RequestIdentity,
  ) {
    return this.records.getVersionContent(id.tenantId, documentId, Number(versionNo));
  }
}
