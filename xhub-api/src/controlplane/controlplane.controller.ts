import { Body, Controller, Get, Param, Post, Query, UseInterceptors } from '@nestjs/common';
import { ControlplaneService } from './controlplane.service';
import { RequirePermission } from '../auth/require-permission.decorator';
import { Identity } from '../auth/identity.decorator';
import type { RequestIdentity } from '../auth/identity.types';
import { TenantScopeInterceptor } from '../xoffice/tenant-scope.interceptor';

/**
 * Tenant Control Plane API. Tenant-scoped: TenantScopeInterceptor wraps every
 * handler in prisma.withTenant(identity.tenantId) so all reads/writes are
 * RLS-scoped (the demo-isolation canary is never served through here).
 * ApplicationDefinition (catalog) is platform-wide and carries no RLS.
 */
@Controller('api/controlplane')
@UseInterceptors(TenantScopeInterceptor)
export class ControlplaneController {
  constructor(private readonly cp: ControlplaneService) {}

  @Get('applications')
  applications() {
    return this.cp.listApplications();
  }

  @Get('tenant-applications')
  tenantApplications(@Identity() id: RequestIdentity) {
    return this.cp.listTenantApplications(id.tenantId);
  }

  @Post('tenant-applications')
  @RequirePermission('provisioning.manage')
  setTenantApplication(
    @Body() body: { applicationCode: string; status?: 'enabled' | 'disabled'; config?: Record<string, any> },
    @Identity() id: RequestIdentity,
  ) {
    return this.cp.setTenantApplication(
      id.tenantId,
      body.applicationCode,
      body.status ?? 'enabled',
      body.config,
    );
  }

  @Get('role-mappings')
  roleMappings(@Query('applicationCode') applicationCode: string, @Identity() id: RequestIdentity) {
    return this.cp.listRoleMappings(id.tenantId, applicationCode || undefined);
  }

  @Get('app-account-bindings')
  bindings(@Query('applicationCode') applicationCode: string, @Identity() id: RequestIdentity) {
    return this.cp.listBindings(id.tenantId, applicationCode || undefined);
  }

  @Post('app-account-bindings')
  @RequirePermission('provisioning.manage')
  createBinding(
    @Body()
    body: {
      personId: string;
      applicationCode: string;
      idempotencyKey?: string;
      correlationId?: string;
      payload?: Record<string, any>;
    },
    @Identity() id: RequestIdentity,
  ) {
    return this.cp.createBinding(id.tenantId, {
      personId: body.personId,
      applicationCode: body.applicationCode,
      idempotencyKey: body.idempotencyKey,
      correlationId: body.correlationId,
      actorId: id.userId,
      payload: body.payload,
    });
  }

  @Get('provisioning-commands')
  commands(@Query('status') status: string, @Identity() id: RequestIdentity) {
    return this.cp.listCommands(id.tenantId, status || undefined);
  }

  @Post('provisioning-commands/:id/retry')
  @RequirePermission('provisioning.manage')
  retry(@Param('id') commandId: string, @Identity() id: RequestIdentity) {
    return this.cp.retryCommand(id.tenantId, commandId);
  }

  @Get('provisioning-conflicts')
  conflicts(@Query('resolved') resolved: string, @Identity() id: RequestIdentity) {
    const flag = resolved === 'true' ? true : resolved === 'false' ? false : undefined;
    return this.cp.listConflicts(id.tenantId, flag);
  }

  @Post('reconcile')
  @RequirePermission('provisioning.manage')
  reconcile(@Identity() id: RequestIdentity) {
    return this.cp.reconcile(id.tenantId);
  }
}
