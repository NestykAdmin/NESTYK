import { Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/guards/auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser, AuthRequestUser } from "../auth/decorators/current-user.decorator";
import { TenantBillingService } from "./tenant-billing.service";

@Controller("bills")
@UseGuards(AuthGuard, RolesGuard)
@Roles("agent")
export class AgentBillsController {
  constructor(private readonly billing: TenantBillingService) {}

  @Get("agent")
  awaiting(@CurrentUser() user: AuthRequestUser) {
    return this.billing.listForAgent(user.id);
  }

  @Get("agent/:id/payment-slip")
  paymentSlipUrl(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.billing.agentSlipUrl(user.id, id);
  }

  @Post("agent/:id/confirm")
  @HttpCode(HttpStatus.OK)
  confirm(
    @CurrentUser() user: AuthRequestUser,
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.billing.confirmForAgent(user.id, id);
  }
}
