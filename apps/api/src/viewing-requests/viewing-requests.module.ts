import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { RentRoomEntity } from '../entities/rent-room.entity';
import { ViewingRequestEntity } from '../entities/viewing-request.entity';
import { ViewingRequestEventEntity } from '../entities/viewing-request-event.entity';
import { PublicListingsModule } from '../public-listings/public-listings.module';
import { AdminViewingRequestsController } from './admin-viewing-requests.controller';
import { AgentViewingRequestsController } from './agent-viewing-requests.controller';
import { MeViewingRequestsController } from './me-viewing-requests.controller';
import { VIEWING_REQUESTS_CLOCK, ViewingRequestsService } from './viewing-requests.service';
import { ViewingRequestsStore } from './viewing-requests.store';

/** Viewing requests from the guest web, coordinated by NESTYK admin (plan 23 Nov 2026). */
@Module({
  imports: [TypeOrmModule.forFeature([ViewingRequestEntity, ViewingRequestEventEntity, RentRoomEntity]), AuthModule, PublicListingsModule],
  controllers: [MeViewingRequestsController, AdminViewingRequestsController, AgentViewingRequestsController],
  providers: [ViewingRequestsStore, ViewingRequestsService, { provide: VIEWING_REQUESTS_CLOCK, useValue: () => Date.now() }],
})
export class ViewingRequestsModule {}
