import { Body, Controller, Get, Header, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthRequestUser, CurrentUser } from '../auth/decorators/current-user.decorator';
import { DatabaseIdPipe } from '../common/database-id.pipe';
import { SingleQueryPipe } from '../common/single-query.pipe';
import { VIEWING_REQUESTS_CACHE_CONTROL } from './me-viewing-requests.controller';
import { ViewingRequestsService } from './viewing-requests.service';

/**
 * NESTYK admin's queue of viewing requests. Actions: forward (to the room's agent), take, schedule, viewed, cancel,
 * close (with a reason) and notes (a coordination note, no status change).
 */
@Controller('admin/viewing-requests')
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin')
export class AdminViewingRequestsController {
  constructor(private readonly requests: ViewingRequestsService) {}

  @Get()
  @Header('Cache-Control', VIEWING_REQUESTS_CACHE_CONTROL)
  list(@Query('status', SingleQueryPipe) status: unknown) {
    return this.requests.adminList(status);
  }

  @Get(':id')
  @Header('Cache-Control', VIEWING_REQUESTS_CACHE_CONTROL)
  get(@Param('id', DatabaseIdPipe) id: number) {
    return this.requests.adminGet(id);
  }

  @Post(':id/:action')
  act(
    @CurrentUser() user: AuthRequestUser,
    @Param('id', DatabaseIdPipe) id: number,
    @Param('action') action: string,
    @Body() body: unknown,
  ) {
    return this.requests.adminAct(user.id, id, action, body);
  }
}
