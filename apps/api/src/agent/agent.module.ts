import { AgreementAttachmentsService } from './contracts/agreement-attachments.service';
import { AgreementAttachmentsController } from './contracts/agreement-attachments.controller';
import { AgentTenantsController } from './tenants/agent-tenants.controller';
import { AgentTenantsService } from './tenants/agent-tenants.service';
import { AgentContractsController } from './contracts/agent-contracts.controller';
import { PublicContractSignController } from './contracts/public-contract-sign.controller';
import { PartyContractsController } from './contracts/party-contracts.controller';
import { AgentContractsService } from './contracts/agent-contracts.service';
import { ContractDocumentStorageService } from './contracts/contract-document-storage.service';
import { LeadEntity } from '../entities/lead.entity';
import { LeadLocationEntity } from '../entities/lead-location.entity';
import { LeadMatchRunEntity } from '../entities/lead-match-run.entity';
import { LeadMatchResultEntity } from '../entities/lead-match-result.entity';
import { AgentLeadsService } from './leads/agent-leads.service';
import { AgentLeadsController } from './leads/agent-leads.controller';
import { LeadMatchingService } from './leads/lead-matching.service';
import { LeadMatchingController } from './leads/lead-matching.controller';
import { LeadViewingEntity } from '../entities/lead-viewing.entity';
import { LeadViewingsService } from './leads/lead-viewings.service';
import { LeadViewingsController } from './leads/lead-viewings.controller';
import { RoomPhotoStorageService } from './rooms/room-photo-storage.service';
import { ListingPromoService } from './rooms/listing-promo.service';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { PropertyEntity } from '../entities/property.entity';
import { MasterPropertyTypeEntity } from '../entities/master-property-type.entity';
import { PropertyOwnerEntity } from '../entities/property-owner.entity';
import { ContactEntity } from '../entities/contact.entity';
import { MasterContractTypeEntity } from '../entities/master-contract-type.entity';
import { MasterRoomTypeEntity } from '../entities/master-room-type.entity';
import { MasterVisaTypeEntity } from '../entities/master-visa-type.entity';
import { MasterListingSourceEntity } from '../entities/master-listing-source.entity';
import { MasterRoomStatusEntity } from '../entities/master-room-status.entity';
import { MasterLayoutEntity } from '../entities/master-layout.entity';
import { MasterFacilityEntity } from '../entities/master-facility.entity';
import { MasterFacilitiesGroupEntity } from '../entities/master-facilities-group.entity';
import { RentRoomEntity } from '../entities/rent-room.entity';
import { RentRoomContactEntity } from '../entities/rent-room-contact.entity';
import { RentRoomPriceEntity } from '../entities/rent-room-price.entity';
import { RoomMediaEntity } from '../entities/room-media.entity';
import { RoomLayoutValueEntity } from '../entities/room-layout-value.entity';
import { RoomFacilityEntity } from '../entities/room-facility.entity';
import { RentRoomDocumentEntity } from '../entities/rent-room-document.entity';
import { AgentRoomsController } from './rooms/agent-rooms.controller';
import { AgentRoomsService } from './rooms/agent-rooms.service';
import { AgentListingsController } from './listings/agent-listings.controller';
import { AgentListingsService } from './listings/agent-listings.service';
import {
  AgentRoomShareLinksController,
  PublicRoomShareController,
} from './listings/room-share-links.controller';
import { RoomShareLinksService } from './listings/room-share-links.service';
import { RoomShareLinkEntity } from '../entities/room-share-link.entity';
import { AgentPlacesController } from './places/agent-places.controller';
import { AgentPlacesService } from './places/agent-places.service';
import { GeminiModule } from '../gemini/gemini.module';

@Module({
  imports: [
    AuthModule,
    GeminiModule,
    TypeOrmModule.forFeature([
      LeadEntity,
      LeadLocationEntity,
      LeadMatchRunEntity,
      LeadMatchResultEntity,
      LeadViewingEntity,
      PropertyEntity,
      MasterPropertyTypeEntity,
      PropertyOwnerEntity,
      ContactEntity,
      MasterContractTypeEntity,
      MasterRoomTypeEntity,
      MasterVisaTypeEntity,
      MasterListingSourceEntity,
      MasterRoomStatusEntity,
      MasterLayoutEntity,
      MasterFacilityEntity,
      MasterFacilitiesGroupEntity,
      RentRoomEntity,
      RentRoomContactEntity,
      RentRoomPriceEntity,
      RoomMediaEntity,
      RoomLayoutValueEntity,
      RoomFacilityEntity,
      RentRoomDocumentEntity,
      RoomShareLinkEntity,
    ]),
  ],
  controllers: [AgreementAttachmentsController, AgentTenantsController, AgentContractsController, PartyContractsController, PublicContractSignController, AgentLeadsController, LeadMatchingController, LeadViewingsController, AgentRoomsController, AgentRoomShareLinksController, PublicRoomShareController, AgentListingsController, AgentPlacesController],
  providers: [AgreementAttachmentsService, AgentTenantsService, AgentContractsService, ContractDocumentStorageService, AgentLeadsService, LeadMatchingService, LeadViewingsService, RoomPhotoStorageService, ListingPromoService, AgentRoomsService, AgentListingsService, RoomShareLinksService, AgentPlacesService],
  exports: [AgentRoomsService, AgentListingsService, AgentPlacesService, RoomShareLinksService],
})
export class AgentModule {}
