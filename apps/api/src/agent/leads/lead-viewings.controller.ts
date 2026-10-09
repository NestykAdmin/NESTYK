import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser, AuthRequestUser } from '../../auth/decorators/current-user.decorator';
import { LeadViewingsService } from './lead-viewings.service';

@Controller('agent')
@UseGuards(AuthGuard, RolesGuard)
@Roles('agent')
export class LeadViewingsController {
  constructor(private readonly viewings: LeadViewingsService) {}
  @Post('leads/:id/viewings') create(@CurrentUser() user: AuthRequestUser, @Param('id', ParseIntPipe) id: number, @Body() body: unknown) { return this.viewings.create(user.id, id, body); }
  @Get('leads/:id/viewings') listForLead(@CurrentUser() user: AuthRequestUser, @Param('id', ParseIntPipe) id: number) { return this.viewings.listForLead(user.id, id); }
  @Get('viewings') range(@CurrentUser() user: AuthRequestUser, @Query('from') from: unknown, @Query('to') to: unknown) { return this.viewings.listRange(user.id, from, to); }
  @Patch('viewings/:id') update(@CurrentUser() user: AuthRequestUser, @Param('id', ParseIntPipe) id: number, @Body() body: unknown) { return this.viewings.update(user.id, id, body); }
}
