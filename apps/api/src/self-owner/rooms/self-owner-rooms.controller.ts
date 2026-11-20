import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DatabaseIdPipe } from '../../common/database-id.pipe';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser, AuthRequestUser } from '../../auth/decorators/current-user.decorator';
import { MAX_ROOM_PHOTO_BYTES } from '../../agent/rooms/room-photo-limits';
import { SelfOwnerRoomsService } from './self-owner-rooms.service';
import type { SelfOwnerRoomBody } from './self-owner-room-input';

type HostRequest = { protocol: string; get(name: string): string };
const baseUrl = (request: HostRequest) => `${request.protocol}://${request.get('host')}`;

/** An owner's own rooms (self_owner_* tables). Agents use /agent/rooms; neither role reaches the other. */
@Controller('self-owner/rooms')
@UseGuards(AuthGuard, RolesGuard)
@Roles('self_owner')
export class SelfOwnerRoomsController {
  constructor(private readonly rooms: SelfOwnerRoomsService) {}

  @Get('options')
  options() {
    return this.rooms.options();
  }

  @Get()
  list(@CurrentUser() user: AuthRequestUser) {
    return this.rooms.list(user);
  }

  @Get(':id')
  detail(@CurrentUser() user: AuthRequestUser, @Param('id', DatabaseIdPipe) id: number) {
    return this.rooms.detail(user, id);
  }

  @Post('media/upload')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_ROOM_PHOTO_BYTES, files: 1, fields: 0 } }))
  upload(@CurrentUser() user: AuthRequestUser, @UploadedFile() file: { buffer: Buffer; size: number } | undefined, @Req() request: HostRequest) {
    return this.rooms.upload(user, file, baseUrl(request));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: AuthRequestUser, @Body() body: SelfOwnerRoomBody, @Req() request: HostRequest) {
    return this.rooms.create(user, body, baseUrl(request));
  }

  @Patch(':id/visibility')
  setVisibility(@CurrentUser() user: AuthRequestUser, @Param('id', DatabaseIdPipe) id: number, @Body() body: { visibility?: unknown }) {
    return this.rooms.setVisibility(user, id, body?.visibility);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthRequestUser, @Param('id', DatabaseIdPipe) id: number, @Body() body: SelfOwnerRoomBody, @Req() request: HostRequest) {
    return this.rooms.update(user, id, body, baseUrl(request));
  }
}
