import { Controller, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/guards/auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser, AuthRequestUser } from "../auth/decorators/current-user.decorator";
import { TenantBillingService } from "./tenant-billing.service";

/**
 * QA (5 Nov 2026): GET /bills/mine, /bills/mine/next and /bills/received only read now. The app calls these before it
 * reads, so a rent bill that fell due today shows at once instead of after the 00:05 job. They issue rent bills by
 * the lease schedule only (never a late fee: M8), and never twice (one bill per lease and period).
 * Kept apart from the tenant and landlord controllers, whose routes stay as they were (the landlord has no POST there).
 */
@Controller("bills")
@UseGuards(AuthGuard, RolesGuard)
export class BillRefreshController {
  constructor(private readonly billing: TenantBillingService) {}

  @Post("mine/refresh")
  @Roles("tenant")
  @HttpCode(HttpStatus.OK)
  tenant(@CurrentUser() user: AuthRequestUser) {
    return this.billing.refreshForTenant(user.id);
  }

  @Post("received/refresh")
  @Roles("landlord")
  @HttpCode(HttpStatus.OK)
  landlord(@CurrentUser() user: AuthRequestUser) {
    return this.billing.refreshForOwner(user.id);
  }
}
