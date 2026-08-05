import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { EvidenceService } from './evidence.service';
import { Identity } from '../auth/identity.decorator';
import type { RequestIdentity } from '../auth/identity.types';

/** Engineering Governance — Evidence Ledger (DG-12-lite). Open read + open create (see service docblock). */
@Controller('api/engineering/evidence')
export class EvidenceController {
  constructor(private readonly evidence: EvidenceService) {}

  @Get()
  list(@Query('subjectType') subjectType: string, @Query('subjectId') subjectId: string) {
    return this.evidence.listForSubject(subjectType, subjectId);
  }

  @Post()
  record(
    @Body() body: { level?: string; subjectType: string; subjectId: string; description: string; sourceRef?: string },
    @Identity() id: RequestIdentity,
  ) {
    return this.evidence.record({ ...body, actorId: id.userId });
  }
}
