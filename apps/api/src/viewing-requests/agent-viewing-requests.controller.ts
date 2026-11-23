import { Body, Controller, Get, Header, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthRequestUser, CurrentUser } from '../auth/decorators/current-user.decorator';
import { DatabaseIdPipe } from '../common/database-id.pipe';
import { VIEWING_REQUESTS_CACHE_CONTROL } from './me-viewing-requests.controller';
import { ViewingRequestsService } from './viewing-requests.service';

/**
 * Viewing requests admin sent to this agent. Actions: handle ("นัดเอง": the agent then sees the guest's contact),
 * hand-to-admin, and, for requests the agent handles, schedule and viewed.
 */
@Controller('agent/viewing-requests')
@UseGuards(AuthGuard, RolesGuard)
@Roles('agent')
export class AgentViewingRequestsController {
  constructor(private readonly requests: ViewingRequestsService) {}

  @Get()
  @Header('Cache-Control', VIEWING_REQUESTS_CACHE_CONTROL)
  list(@CurrentUser() user: AuthRequestUser) {
    return this.requests.agentList(user.id);
  }

  @Post(':id/:action')
  act(
    @CurrentUser() user: AuthRequestUser,
    @Param('id', DatabaseIdPipe) id: number,
    @Param('action') action: string,
    @Body() body: unknown,
  ) {
    return this.requests.agentAct(user.id, id, action, body);
  }
}
