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
    // Step 28 (B0b): close the ended leases first, so a stay that ends tonight frees its room for the next
    // tenant's stay before billing activates it; each part runs even when the other fails.
    try {
      await this.billing.persistEndedLeases();
    } catch (error) {
      this.logger.error("Failed to close ended leases", error instanceof Error ? error.stack : String(error));
    }
    try {
      await this.billing.ensureAllActive();
    } catch (error) {
      this.logger.error("Failed to issue rent bills", error instanceof Error ? error.stack : String(error));
    }
  }
}
