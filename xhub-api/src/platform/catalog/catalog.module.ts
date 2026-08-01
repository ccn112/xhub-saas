import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ControlplaneModule } from '../../controlplane/controlplane.module';
import { CatalogService } from './catalog.service';
import { BlueprintController, SeedPackController } from './catalog.controller';

/**
 * Blueprint & Seed Pack catalog module (SaaS step 4 — E5). Additive. SHARED /
 * platform-plane. Reuses ControlplaneService (enable apps) + the backup secret
 * guard + WorkflowVersion immutability precedent — no new engine.
 */
@Module({
  imports: [PrismaModule, ControlplaneModule],
  controllers: [BlueprintController, SeedPackController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
