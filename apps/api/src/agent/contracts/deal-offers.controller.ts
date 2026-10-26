import { DatabaseIdPipe } from "../../common/database-id.pipe";
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../../auth/guards/auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { Roles } from "../../auth/decorators/roles.decorator";
import { CurrentUser, AuthRequestUser } from "../../auth/decorators/current-user.decorator";
import { DealOffersService } from "./deal-offers.service";

/** D2 (AC-2.1 to 2.4): the agent's side of the offer a landlord confirms before booking. */
@Controller("agent")
@UseGuards(AuthGuard, RolesGuard)
@Roles("agent")
export class DealOffersController {
  constructor(private readonly offers: DealOffersService) {}

  @Get("leads/:leadId/deal-offers")
  list(@CurrentUser() user: AuthRequestUser, @Param("leadId", DatabaseIdPipe) leadId: number) {
    return this.offers.listForLead(user.id, leadId);
  }

  @Post("deal-offers")
  create(@CurrentUser() user: AuthRequestUser, @Body() body: unknown) {
    return this.offers.create(user.id, body);
  }

  @Put("deal-offers/:id")
  update(@CurrentUser() user: AuthRequestUser, @Param("id", DatabaseIdPipe) id: number, @Body() body: unknown) {
    return this.offers.update(user.id, id, body);
  }

  /** D2 round 2 (AC-2.4): change a confirmed offer with a reason and how the landlord agreed. */
  @Post("deal-offers/:id/revise")
  @HttpCode(HttpStatus.OK)
  revise(@CurrentUser() user: AuthRequestUser, @Param("id", DatabaseIdPipe) id: number, @Body() body: unknown) {
    return this.offers.revise(user.id, id, body);
  }

  @Post("deal-offers/:id/send")
  @HttpCode(HttpStatus.OK)
  send(@CurrentUser() user: AuthRequestUser, @Param("id", DatabaseIdPipe) id: number, @Body() body: unknown) {
    return this.offers.send(user.id, id, body);
  }

  /** The agent records the landlord's confirmation (phone, LINE, in person or other, with a note). */
  @Post("deal-offers/:id/confirm")
  @HttpCode(HttpStatus.OK)
  confirm(@CurrentUser() user: AuthRequestUser, @Param("id", DatabaseIdPipe) id: number, @Body() body: unknown) {
    return this.offers.recordConfirmation(user.id, id, body);
  }

  @Post("deal-offers/:id/cancel")
  @HttpCode(HttpStatus.OK)
  cancel(@CurrentUser() user: AuthRequestUser, @Param("id", DatabaseIdPipe) id: number, @Body() body: unknown) {
    return this.offers.cancel(user.id, id, body);
  }
}
