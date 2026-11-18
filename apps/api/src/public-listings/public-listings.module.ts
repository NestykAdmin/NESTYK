import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RentRoomEntity } from '../entities/rent-room.entity';
import { PublicAreasController, PublicRoomsController } from './public-rooms.controller';
import { PublicRoomsService } from './public-rooms.service';

/** Read-only public listings for the guest web (S6, project-docs/nestyk-guest-home-public-api-plan-20261111.md). */
@Module({
  imports: [TypeOrmModule.forFeature([RentRoomEntity])],
  controllers: [PublicRoomsController, PublicAreasController],
  providers: [PublicRoomsService],
  exports: [PublicRoomsService],
})
export class PublicListingsModule {}
