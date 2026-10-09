import { MasterDocumentTypeEntity, AgreementDocumentRequirementEntity, AgreementDocumentEntity } from "./agreement-document.entity";
import { AgreementTemplateEntity } from "./agreement-template.entity";
export * from "./agreement-template.entity";
export * from "./agreement-sign-invite.entity";
export * from "./room-share-link.entity";
import { AgreementSignInviteEntity } from "./agreement-sign-invite.entity";
import { RoomShareLinkEntity } from "./room-share-link.entity";
import { MasterAgreementTypeEntity } from './master-agreement-type.entity';
export * from './base.entity';
export * from './user.entity';
export * from './master-role.entity';
export * from './user-role.entity';
export * from './property.entity';
export * from './master-property-type.entity';
export * from './property-owner.entity';
export * from './contact.entity';
export * from './master-contract-type.entity';
export * from './master-room-type.entity';
export * from './master-visa-type.entity';
export * from './master-listing-source.entity';
export * from './master-room-status.entity';
export * from './master-layout.entity';
export * from './master-facilities-group.entity';
export * from './master-facility.entity';
export * from './rent-room.entity';
export * from './rent-room-contact.entity';
export * from './rent-room-price.entity';
export * from './room-media.entity';
export * from './rent-room-document.entity';
export * from './room-layout-value.entity';
export * from './room-facility.entity';
export * from './lead.entity';
export * from './tenant.entity';
export * from './room-tenancy.entity';
export * from './lease-contract.entity';

import { UserEntity } from './user.entity';
import { MasterRoleEntity } from './master-role.entity';
import { UserRoleEntity } from './user-role.entity';
import { PropertyEntity } from './property.entity';
import { MasterPropertyTypeEntity } from './master-property-type.entity';
import { PropertyOwnerEntity } from './property-owner.entity';
import { ContactEntity } from './contact.entity';
import { MasterContractTypeEntity } from './master-contract-type.entity';
import { MasterRoomTypeEntity } from './master-room-type.entity';
import { MasterVisaTypeEntity } from './master-visa-type.entity';
import { MasterListingSourceEntity } from './master-listing-source.entity';
import { MasterRoomStatusEntity } from './master-room-status.entity';
import { MasterLayoutEntity } from './master-layout.entity';
import { MasterFacilitiesGroupEntity } from './master-facilities-group.entity';
import { MasterFacilityEntity } from './master-facility.entity';
import { RentRoomEntity } from './rent-room.entity';
import { RentRoomContactEntity } from './rent-room-contact.entity';
import { RentRoomPriceEntity } from './rent-room-price.entity';
import { RoomMediaEntity } from './room-media.entity';
import { RentRoomDocumentEntity } from './rent-room-document.entity';
import { RoomLayoutValueEntity } from './room-layout-value.entity';
import { RoomFacilityEntity } from './room-facility.entity';
import { LeadEntity } from './lead.entity';
import { LeadLocationEntity } from './lead-location.entity';
import { LeadMatchRunEntity } from './lead-match-run.entity';
import { LeadMatchResultEntity } from './lead-match-result.entity';
import { LeadViewingEntity } from './lead-viewing.entity';
import { TenantEntity } from './tenant.entity';
import { RoomTenancyEntity } from './room-tenancy.entity';
import { LeaseContractEntity } from './lease-contract.entity';
import { AgentInvoiceEntity } from './agent-invoice.entity';
import { AgentCommissionConfirmationEntity } from './agent-commission-confirmation.entity';
import { TenantBillEntity } from './tenant-bill.entity';
export * from './agent-invoice.entity';
export * from './agent-commission-confirmation.entity';
export * from './tenant-bill.entity';

/** All blueprint tables (docs/new-project) — public schema via DATABASE_URL */
export const ALL_ENTITIES = [
  MasterDocumentTypeEntity, AgreementDocumentRequirementEntity, AgreementDocumentEntity,
  AgreementTemplateEntity,
  AgreementSignInviteEntity,
  RoomShareLinkEntity,
  MasterAgreementTypeEntity,
  UserEntity,
  MasterRoleEntity,
  UserRoleEntity,
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
  MasterFacilitiesGroupEntity,
  MasterFacilityEntity,
  RentRoomEntity,
  RentRoomContactEntity,
  RentRoomPriceEntity,
  RoomMediaEntity,
  RentRoomDocumentEntity,
  RoomLayoutValueEntity,
  RoomFacilityEntity,
  LeadEntity,
  LeadLocationEntity,
  LeadMatchRunEntity,
  LeadMatchResultEntity,
  LeadViewingEntity,
  TenantEntity,
  RoomTenancyEntity,
  LeaseContractEntity,
  AgentInvoiceEntity,
  AgentCommissionConfirmationEntity,
  TenantBillEntity,
];

/** @deprecated use ALL_ENTITIES */
export const ALL_PROPTECH_ENTITIES = ALL_ENTITIES;
