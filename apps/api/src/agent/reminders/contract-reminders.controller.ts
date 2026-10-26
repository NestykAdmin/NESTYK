import { Controller, Get, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../../auth/guards/auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { Roles } from "../../auth/decorators/roles.decorator";
import { CurrentUser, AuthRequestUser } from "../../auth/decorators/current-user.decorator";
import { ContractRemindersService } from "./contract-reminders.service";

/** D4: the agent's reminders (what is late or due), worked out now. */
@Controller("agent")
@UseGuards(AuthGuard, RolesGuard)
@Roles("agent")
export class AgentRemindersController {
  constructor(private readonly reminders: ContractRemindersService) {}

  @Get("reminders")
  list(@CurrentUser() user: AuthRequestUser) {
    return this.reminders.forAgent(user.id);
  }
}
