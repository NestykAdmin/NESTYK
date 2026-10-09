import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ContractDocumentStorageService } from "../agent/contracts/contract-document-storage.service";
import { AgentBillsController } from "./agent-bills.controller";
import { OwnerBillsController } from "./owner-bills.controller";
import { TenantBillsController } from "./tenant-bills.controller";
import { TenantBillingService } from "./tenant-billing.service";
import { TenantBillingScheduler } from "./tenant-billing.scheduler";

@Module({
  imports: [AuthModule],
  controllers: [TenantBillsController, OwnerBillsController, AgentBillsController],
  providers: [TenantBillingService, TenantBillingScheduler, ContractDocumentStorageService],
})
export class BillingModule {}
