import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { TenantBillingService } from "./tenant-billing.service";

@Injectable()
export class TenantBillingScheduler {
  private readonly logger = new Logger(TenantBillingScheduler.name);

  constructor(private readonly billing: TenantBillingService) {}

  /** Safe on multiple API instances: `(lease_contract_id, period)` is unique and inserts ignore conflicts. */
  @Cron("5 0 * * *", { name: "tenant-rent-bills", timeZone: "Asia/Bangkok" })
  async issueDueBills() {
    try {
      await this.billing.ensureAllActive();
    } catch (error) {
      this.logger.error("Failed to issue rent bills", error instanceof Error ? error.stack : String(error));
    }
  }
}
