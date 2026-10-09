import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser, AuthRequestUser } from '../../auth/decorators/current-user.decorator';
import { LeadMatchingService } from './lead-matching.service';

@Controller('agent/leads/:id')
@UseGuards(AuthGuard, RolesGuard)
@Roles('agent')
export class LeadMatchingController {
  constructor(private readonly matching: LeadMatchingService) {}
  @Get('match-settings') settings(@CurrentUser() user: AuthRequestUser, @Param('id', ParseIntPipe) id: number) { return this.matching.getSettings(user.id, id); }
  @Patch('match-settings') saveSettings(@CurrentUser() user: AuthRequestUser, @Param('id', ParseIntPipe) id: number, @Body() body: unknown) { return this.matching.saveSettings(user.id, id, body); }
  @Post('match-runs') run(@CurrentUser() user: AuthRequestUser, @Param('id', ParseIntPipe) id: number) { return this.matching.run(user.id, id); }
  @Delete('match-runs') @HttpCode(204) clear(@CurrentUser() user: AuthRequestUser, @Param('id', ParseIntPipe) id: number) { return this.matching.clear(user.id, id); }
  @Get('match-runs/latest') latest(@CurrentUser() user: AuthRequestUser, @Param('id', ParseIntPipe) id: number) { return this.matching.latest(user.id, id); }
}
