import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { RequirePermission } from '../auth/require-permission.decorator';
import { Identity } from '../auth/identity.decorator';
import type { RequestIdentity } from '../auth/identity.types';

/** Engineering Governance — Document catalog (DG-03-lite). Reads open; writes gated `engineering.docs.manage`. */
@Controller('api/engineering/documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  list(@Query('productId') productId: string, @Query('documentType') documentType?: string) {
    return this.documents.list(productId, documentType);
  }

  @Get(':idOrCode')
  get(@Param('idOrCode') idOrCode: string) {
    return this.documents.get(idOrCode);
  }

  @Post()
  @RequirePermission('engineering.docs.manage')
  create(
    @Body()
    body: {
      productId: string;
      code: string;
      title: string;
      documentType?: string;
      classification?: string;
      body?: string;
      standardsRefs?: string[];
      ownerRole?: string;
    },
    @Identity() id: RequestIdentity,
  ) {
    return this.documents.create({ ...body, actorId: id.userId });
  }

  @Patch(':id')
  @RequirePermission('engineering.docs.manage')
  update(
    @Param('id') id_: string,
    @Body() body: { title?: string; body?: string; status?: string; standardsRefs?: string[] },
    @Identity() id: RequestIdentity,
  ) {
    return this.documents.update(id_, { ...body, actorId: id.userId });
  }
}
