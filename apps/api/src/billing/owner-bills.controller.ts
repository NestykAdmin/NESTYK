import { Controller, Get, Param, ParseIntPipe, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/guards/auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import {
  CurrentUser,
  AuthRequestUser,
} from "../auth/decorators/current-user.decorator";
import { TenantBillingService } from "./tenant-billing.service";

@Controller("bills")
@UseGuards(AuthGuard, RolesGuard)
@Roles("owner")
export class OwnerBillsController {
  constructor(private readonly billing: TenantBillingService) {}

  @Get("received")
  received(@CurrentUser() user: AuthRequestUser) {
    return this.billing.listReceived(user.id);
  }

  @Get("received/:id/payment-slip")
  paymentSlipUrl(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.billing.receivedSlipUrl(user.id, id);
  }
}
