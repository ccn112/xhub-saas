import { Global, Module } from '@nestjs/common';
import { XofficePrismaService } from './xoffice-prisma.service';

@Global()
@Module({
  providers: [XofficePrismaService],
  exports: [XofficePrismaService],
})
export class XofficePrismaModule {}
