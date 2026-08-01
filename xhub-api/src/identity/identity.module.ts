import { Module } from '@nestjs/common';
import { IdentityService } from './identity.service';
import { AssignmentResolver } from './assignment-resolver.service';
import { IdentityController } from './identity.controller';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * Identity/Organization Core — the SHARED platform domain (not a sub-module of
 * XOffice). Exports IdentityService + AssignmentResolver so XOffice can call the
 * multi-selector resolver while keeping its flat resolver for backward-compat.
 */
@Module({
  imports: [PrismaModule],
  controllers: [IdentityController],
  providers: [IdentityService, AssignmentResolver],
  exports: [IdentityService, AssignmentResolver],
})
export class IdentityModule {}
