import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser, AuthRequestUser } from '../../auth/decorators/current-user.decorator';
import { AgentDashboardService } from './agent-dashboard.service';
@Controller('agent/dashboard')
@UseGuards(AuthGuard, RolesGuard)
@Roles('agent')
export class AgentDashboardController {
  constructor(private readonly dashboard: AgentDashboardService) {}
  @Get() summary(@CurrentUser() user: AuthRequestUser, @Query() query: Record<string, unknown>) { return this.dashboard.summary(user.id, query); }
  @Get('work-items') workItems(@CurrentUser() user: AuthRequestUser, @Query() query: Record<string, unknown>) { return this.dashboard.workItems(user.id, query); }
}
