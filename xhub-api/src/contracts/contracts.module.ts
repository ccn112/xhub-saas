import { Module } from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { ContractsController } from './contracts.controller';
import { XofficePrismaModule } from '../xoffice-prisma/xoffice-prisma.module';
import { XofficeTenantScopeInterceptor } from '../common/xoffice-tenant-scope.interceptor';

/**
 * Contract module (Phase 2, BO-0206/0207/0208). X.Office-only, additive.
 * Covers Contract/ContractLine (state machine + immutability guard),
 * ContractSignature (mock e-signature seam), ContractObligation (auto-
 * generated alert/obligation engine), and BillingRequest (bridge to
 * KPI-BIL-001 — NOT wired to a real FinERP this pass).
 */
@Module({
  imports: [XofficePrismaModule],
  controllers: [ContractsController],
  providers: [ContractsService, XofficeTenantScopeInterceptor],
  exports: [ContractsService],
})
export class ContractsModule {}
