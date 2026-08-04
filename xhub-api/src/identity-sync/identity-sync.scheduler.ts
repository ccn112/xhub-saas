import { Injectable, OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { IdentitySyncService } from './identity-sync.service';

const SYNC_INTERVAL_MS = Number(process.env.IDENTITY_SYNC_INTERVAL_MS ?? 60_000);

/** Runs IdentitySyncService.syncAll() once on boot, then every SYNC_INTERVAL_MS. */
@Injectable()
export class IdentitySyncScheduler implements OnModuleInit {
  constructor(private readonly sync: IdentitySyncService) {}

  async onModuleInit(): Promise<void> {
    await this.sync.syncAll().catch(() => {});
  }

  @Interval(SYNC_INTERVAL_MS)
  async tick(): Promise<void> {
    await this.sync.syncAll();
  }
}
