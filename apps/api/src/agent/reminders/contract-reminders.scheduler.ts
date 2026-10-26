import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { ContractRemindersService } from "./contract-reminders.service";

@Injectable()
export class ContractRemindersScheduler {
  private readonly logger = new Logger(ContractRemindersScheduler.name);

  constructor(private readonly reminders: ContractRemindersService) {}

  /** D4: every morning at 08:00 Bangkok time (after the rent bills of 00:05), record and e-mail what is due. */
  @Cron("0 8 * * *", { name: "contract-reminders", timeZone: "Asia/Bangkok" })
  async remind() {
    try {
      const result = await this.reminders.run();
      this.logger.log(`Reminders: ${result.due} due, ${result.emailed} e-mailed`);
    } catch (error) {
      this.logger.error("Failed to send reminders", error instanceof Error ? error.stack : String(error));
    }
  }
}
