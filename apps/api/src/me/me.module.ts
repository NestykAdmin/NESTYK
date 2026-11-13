import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { SavedRoomEntity } from '../entities/saved-room.entity';
import { PublicListingsModule } from '../public-listings/public-listings.module';
import { SavedRoomsController } from './saved-rooms.controller';
import { SavedRoomsService, SavedRoomsStore } from './saved-rooms.service';

/** The signed-in account's own things (AUTH-3: saved rooms). */
@Module({
  imports: [TypeOrmModule.forFeature([SavedRoomEntity]), AuthModule, PublicListingsModule],
  controllers: [SavedRoomsController],
  providers: [SavedRoomsStore, SavedRoomsService],
})
export class MeModule {}
