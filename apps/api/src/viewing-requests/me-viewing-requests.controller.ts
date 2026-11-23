import { Body, Controller, Get, Header, Param, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { AuthRequestUser, CurrentUser } from '../auth/decorators/current-user.decorator';
import { DatabaseIdPipe } from '../common/database-id.pipe';
import { ViewingRequestsService } from './viewing-requests.service';

/** Personal answers: never kept by a browser or a shared cache (same as saved rooms). */
export const VIEWING_REQUESTS_CACHE_CONTROL = 'private, no-store';

/** AuthGuard lets a valid token through without an account row; these routes need the account (as saved rooms). */
function account(user: AuthRequestUser | undefined): AuthRequestUser {
  if (!user?.id) throw new UnauthorizedException('Call POST /auth/sync first');
  return user;
}

/** The signed-in account's own viewing requests. Any role may ask (plan section 3), so there is no role guard. */
@Controller('me/viewing-requests')
@UseGuards(AuthGuard)
export class MeViewingRequestsController {
  constructor(private readonly requests: ViewingRequestsService) {}

  @Post()
  create(@CurrentUser() user: AuthRequestUser | undefined, @Body() body: unknown) {
    return this.requests.create(account(user), body);
  }

  @Get()
  @Header('Cache-Control', VIEWING_REQUESTS_CACHE_CONTROL)
  list(@CurrentUser() user: AuthRequestUser | undefined) {
    return this.requests.listMine(account(user).id);
  }

  @Post(':id/cancel')
  cancel(@CurrentUser() user: AuthRequestUser | undefined, @Param('id', DatabaseIdPipe) id: number) {
    return this.requests.cancelMine(account(user).id, id);
  }
}
