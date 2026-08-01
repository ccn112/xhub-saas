import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { XofficeService } from './xoffice.service';

/**
 * SLA / timer / reminder / escalation worker. Runs a sweep every ~30s.
 * The actual sweep logic lives in XofficeService.runSchedulerSweep so the
 * same code path is reachable via POST /scheduler/tick for demo/test (the
 * seed clock is fixed, so a manual tick is needed to force overdue).
 */
@Injectable()
export class SchedulerService {
  private readonly log = new Logger('XofficeScheduler');

  constructor(private readonly xoffice: XofficeService) {}

  @Interval(30_000)
  async sweep(): Promise<void> {
    try {
      const res = await this.xoffice.runSchedulerSweep();
      if (res.reminders || res.escalations || res.advanced) {
        this.log.log(
          `sweep: reminders=${res.reminders} escalations=${res.escalations} advanced=${res.advanced}`,
        );
      }
    } catch (e) {
      this.log.error(`sweep failed: ${(e as Error).message}`);
    }
  }
}
