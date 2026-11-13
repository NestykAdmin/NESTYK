import { Controller, Delete, Get, Header, HttpCode, Param, Put, UnauthorizedException, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { AuthRequestUser, CurrentUser } from '../auth/decorators/current-user.decorator';
import { SavedRoomsService } from './saved-rooms.service';

/** Personal answers: never kept by a browser or a shared cache. */
export const SAVED_ROOMS_CACHE_CONTROL = 'private, no-store';

/**
 * AuthGuard lets a valid token through without an account row (so POST /auth/sync can create it). These routes need
 * the account: answer 401 instead of crashing on user.id (review R2).
 */
function accountId(user: AuthRequestUser | undefined): number {
  if (!user?.id) throw new UnauthorizedException('Call POST /auth/sync first');
  return user.id;
}

/** Saved rooms of the signed-in account (AUTH-3). Any role may use it (D5), so there is no role guard. */
@Controller('me/saved-rooms')
@UseGuards(AuthGuard)
export class SavedRoomsController {
  constructor(private readonly saved: SavedRoomsService) {}

  @Get('ids')
  @Header('Cache-Control', SAVED_ROOMS_CACHE_CONTROL)
  ids(@CurrentUser() user: AuthRequestUser | undefined) {
    return this.saved.ids(accountId(user));
  }

  @Get()
  @Header('Cache-Control', SAVED_ROOMS_CACHE_CONTROL)
  list(@CurrentUser() user: AuthRequestUser | undefined) {
    return this.saved.list(accountId(user));
  }

  @Put(':roomId')
  @HttpCode(204)
  save(@CurrentUser() user: AuthRequestUser | undefined, @Param('roomId') roomId: string) {
    return this.saved.save(accountId(user), roomId);
  }

  @Delete(':roomId')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthRequestUser | undefined, @Param('roomId') roomId: string) {
    return this.saved.remove(accountId(user), roomId);
  }
}
