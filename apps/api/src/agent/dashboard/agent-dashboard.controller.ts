import { Controller, Get, UseGuards } from '@nestjs/common';
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

  @Get()
  get(@CurrentUser() user: AuthRequestUser) {
    return this.dashboard.getDashboard(user.id);
  }
}
