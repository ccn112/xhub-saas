import { Controller, Post } from '@nestjs/common';
import { IdentitySyncService } from './identity-sync.service';
import { RequirePermission } from '../auth/require-permission.decorator';

/** Manual on-demand trigger (verification/testing) — the real driver is IdentitySyncScheduler. */
@Controller('api/identity-sync')
export class IdentitySyncController {
  constructor(private readonly sync: IdentitySyncService) {}

  @Post('run')
  @RequirePermission('identity.manage')
  async run() {
    await this.sync.syncAll();
    return { ok: true };
  }
}
