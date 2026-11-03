import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AuthService } from './auth.service';
import { scheduledJobsDisabled } from '../common/scheduled-jobs';

@Injectable()
export class AccountDeletionScheduler {
  private readonly logger = new Logger(AccountDeletionScheduler.name);

  constructor(private readonly auth: AuthService) {}

  /** 00:10 Bangkok. A scheduled deletion stays until this run, and can be cancelled before then. */
  @Cron('10 0 * * *', { name: 'account-deletions', timeZone: 'Asia/Bangkok' })
  async deleteDueAccounts() {
    if (scheduledJobsDisabled()) {
      this.logger.log('Skipped: DISABLE_SCHEDULED_JOBS=true');
      return;
    }
    try {
      await this.auth.deleteDueAccounts();
    } catch (error) {
      this.logger.error('Failed to delete scheduled accounts', error instanceof Error ? error.stack : String(error));
    }
  }
}
