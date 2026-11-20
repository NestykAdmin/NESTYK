import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RoomPhotoStorageService } from '../agent/rooms/room-photo-storage.service';
import { SelfOwnerRoomsController } from './rooms/self-owner-rooms.controller';
import { SELF_OWNER_ROOM_PHOTOS, SelfOwnerRoomsService } from './rooms/self-owner-rooms.service';

/** Self owner features. Rooms live in their own tables (D4); photos reuse the agent's storage bucket and rules. */
@Module({
  imports: [AuthModule],
  controllers: [SelfOwnerRoomsController],
  providers: [RoomPhotoStorageService, { provide: SELF_OWNER_ROOM_PHOTOS, useExisting: RoomPhotoStorageService }, SelfOwnerRoomsService],
})
export class SelfOwnerModule {}
