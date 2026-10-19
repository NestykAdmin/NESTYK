import { DatabaseIdPipe } from '../../common/database-id.pipe';
import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser, AuthRequestUser } from '../../auth/decorators/current-user.decorator';
import { SingleQueryPipe } from '../../common/single-query.pipe';
import { AgentCalendarService } from './agent-calendar.service';

@Controller('agent/calendar/events')
@UseGuards(AuthGuard, RolesGuard)
@Roles('agent')
export class AgentCalendarController {
  constructor(private readonly calendar: AgentCalendarService) {}
  @Get() list(@CurrentUser() user: AuthRequestUser, @Query('from', SingleQueryPipe) from: unknown, @Query('to', SingleQueryPipe) to: unknown) { return this.calendar.list(user.id, from, to); }
  @Post() create(@CurrentUser() user: AuthRequestUser, @Body() body: unknown) { return this.calendar.create(user.id, body); }
  @Patch(':id') update(@CurrentUser() user: AuthRequestUser, @Param('id', DatabaseIdPipe) id: number, @Body() body: unknown) { return this.calendar.update(user.id, id, body); }

}
