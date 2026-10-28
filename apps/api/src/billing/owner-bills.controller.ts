import { DatabaseIdPipe } from '../common/database-id.pipe';
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from "@nestjs/common";
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
@Roles("landlord")
export class OwnerBillsController {
  constructor(private readonly billing: TenantBillingService) {}

  @Get("received")
  received(@CurrentUser() user: AuthRequestUser) {
    return this.billing.listReceived(user.id);
  }

  @Get("received/:id/payment-slip")
  paymentSlipUrl(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", DatabaseIdPipe) id: number,
  ) {
    return this.billing.receivedSlipUrl(user.id, id);
  }

  /** AC-7.8: the landlord of the room issues one late fee. The amount is typed. */
  @Post("received/:id/late-fee")
  @HttpCode(HttpStatus.OK)
  createLateFee(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", DatabaseIdPipe) id: number,
    @Body() body: unknown,
  ) {
    return this.billing.createLateFeeForLandlord(user.id, id, body);
  }

  /** D12: the landlord can open a late fee invoice, receipt or slip. */
  @Get("received/:id/late-fee/:kind")
  lateFeeUrl(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", DatabaseIdPipe) id: number,
    @Param("kind") kind: string,
  ) {
    return this.billing.lateFeeUrlForOwner(user.id, id, kind);
  }
}
