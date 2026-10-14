import { validateNearbyPlaces, validCoordinates, distanceMeters } from '../places/nearby-places';
import { validateRoomInput } from './room-input';
import type { NearbyPlace } from '@nestyk/types';
import { RoomPhotoStorageService } from './room-photo-storage.service';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { AuthRequestUser } from '../../auth/decorators/current-user.decorator';
import { PropertyEntity } from '../../entities/property.entity';
import { MasterPropertyTypeEntity } from '../../entities/master-property-type.entity';
import { PropertyOwnerEntity } from '../../entities/property-owner.entity';
import { ContactEntity } from '../../entities/contact.entity';
import { MasterContractTypeEntity } from '../../entities/master-contract-type.entity';
import { MasterRoomTypeEntity } from '../../entities/master-room-type.entity';
import { MasterListingSourceEntity } from '../../entities/master-listing-source.entity';
import { MasterRoomStatusEntity } from '../../entities/master-room-status.entity';
import { MasterLayoutEntity } from '../../entities/master-layout.entity';
import { MasterFacilityEntity } from '../../entities/master-facility.entity';
import { RentRoomEntity } from '../../entities/rent-room.entity';
import { RentRoomContactEntity } from '../../entities/rent-room-contact.entity';
import { RentRoomPriceEntity } from '../../entities/rent-room-price.entity';
import { RoomMediaEntity } from '../../entities/room-media.entity';
import { RoomLayoutValueEntity } from '../../entities/room-layout-value.entity';
import { RoomFacilityEntity } from '../../entities/room-facility.entity';
import { RentRoomDocumentEntity } from '../../entities/rent-room-document.entity';
import { CreateRoomBody, CreateRoomContactInput } from './dto/create-room.dto';

@Injectable()
export class AgentRoomsService {
  constructor(
    private readonly photos: RoomPhotoStorageService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(PropertyEntity)
    private readonly propertiesRepo: Repository<PropertyEntity>,
    @InjectRepository(PropertyOwnerEntity)
    private readonly propertyOwnersRepo: Repository<PropertyOwnerEntity>,
    @InjectRepository(ContactEntity)
    private readonly contactsRepo: Repository<ContactEntity>,
    @InjectRepository(MasterPropertyTypeEntity)
    private readonly propertyTypesRepo: Repository<MasterPropertyTypeEntity>,
    @InjectRepository(MasterContractTypeEntity)
    private readonly contractTypesRepo: Repository<MasterContractTypeEntity>,
    @InjectRepository(MasterRoomTypeEntity)
    private readonly roomTypesRepo: Repository<MasterRoomTypeEntity>,
    @InjectRepository(MasterFacilityEntity)
    private readonly facilitiesRepo: Repository<MasterFacilityEntity>,
  ) {}

  async listProperties(agentId: number) {
    // Reuse any property previously linked to this agent's scout rooms,
    // plus all properties for greenfield simplicity (wizard picker).
    const used = await this.dataSource.query(
      `
      SELECT DISTINCT p.*
      FROM properties p
      INNER JOIN rent_rooms r ON r.properties_id = p.id
      WHERE r.is_scout_room = TRUE
        AND r.created_by_user_id = $1
      ORDER BY p.name ASC
      `,
      [agentId],
    );
    if (used.length) return used;
    return this.propertiesRepo.find({ order: { name: 'ASC' }, take: 100 });
  }

  async listPropertyTypes() {
    const rows = await this.propertyTypesRepo.find({ order: { id: 'ASC' } });
    return rows.map((row) => ({ id: row.id, code: row.code }));
  }

  async listContractTypes() {
    const rows = await this.contractTypesRepo.find({
      where: { is_active: true },
      order: { sort_order: 'ASC', id: 'ASC' },
    });
    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      termMonths: row.term_months,
    }));
  }

  async listFacilities() {
    const catalogGroups = new Set([
      'furniture',
      'appliances',
      'room_features',
      'parking',
      'project_facilities',
      'security_services',
    ]);
    const rows = await this.facilitiesRepo.find({
      relations: { group: true },
      order: { group: { sort_order: 'ASC', id: 'ASC' }, sort_order: 'ASC', id: 'ASC' },
    });
    return rows
      .filter((row) => catalogGroups.has(row.group?.code ?? ''))
      .map((row) => ({
        code: row.code,
        groupCode: row.group.code,
        isExtraCharge: row.is_extra_charge,
      }));
  }

  async listRoomTypes() {
    const rows = await this.roomTypesRepo.find({
      where: { is_active: true },
      order: { sort_order: 'ASC', id: 'ASC' },
    });
    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      bedroomCount: row.bedroom_count,
    }));
  }

  async listContacts(agentId: number) {
    const rows: Array<{
      id: number;
      name: string;
      phone: string;
      email: string | null;
      lineId: string | null;
      facebook: string | null;
      note: string | null;
      roomCount: number | string;
    }> = await this.dataSource.query(
      `
      SELECT
        c.id,
        c.name,
        c.phone,
        c.email,
        c.line_id AS "lineId",
        c.facebook,
        c.note,
        COUNT(rrc.id)::int AS "roomCount"
      FROM contacts c
      LEFT JOIN rent_room_contacts rrc ON rrc.contact_id = c.id
      WHERE c.created_by_user_id = $1
      GROUP BY c.id
      ORDER BY c.name ASC
      `,
      [agentId],
    );
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      phone: row.phone,
      email: row.email,
      lineId: row.lineId,
      facebook: row.facebook,
      note: row.note,
      roomCount: Number(row.roomCount) || 0,
    }));
  }

  async listPropertyOwners(agentId: number) {
    const rows: Array<{
      id: number;
      name: string;
      phone: string;
      email: string | null;
      note: string | null;
      roomCount: number | string;
    }> = await this.dataSource.query(
      `
      SELECT
        po.id,
        po.name,
        po.phone,
        po.email,
        po.note,
        COUNT(r.id)::int AS "roomCount"
      FROM property_owners po
      LEFT JOIN rent_rooms r ON r.property_owner_id = po.id
      WHERE po.created_by_user_id = $1
      GROUP BY po.id
      ORDER BY po.name ASC
      `,
      [agentId],
    );
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      phone: row.phone,
      email: row.email,
      note: row.note,
      roomCount: Number(row.roomCount) || 0,
    }));
  }

  async createScoutRoom(agent: AuthRequestUser, body: CreateRoomBody, baseUrl: string, existingId?: number) {
    this.validateCreateBody(body);
    body = { ...body, medias: body.medias ?? [] };

    return this.dataSource.transaction(async (manager) => {
      const existing = existingId == null ? null : await manager.findOne(RentRoomEntity, {
        where: { id: existingId, created_by_user_id: agent.id, is_scout_room: true },
        lock: { mode: 'pessimistic_write' },
      });
      if (existingId != null && !existing) throw new NotFoundException('Room not found');
      const oldMedias = existing ? await manager.find(RoomMediaEntity, { where: { rent_id: existing.id } }) : [];
      const oldUrls = new Set(oldMedias.map((m) => m.media_url));
      if (new Set(body.medias!.map((m) => m.mediaUrl)).size !== body.medias!.length) {
        throw new BadRequestException('Room photos must be different files');
      }
      await this.photos.validateRoomPhotos(agent.id, body.medias!.filter((m) => !oldUrls.has(m.mediaUrl)), baseUrl);
      const contactIds = await this.resolveContactIds(manager, agent.id, body);
      const propertyId = await this.resolvePropertyForSave(manager, body, existing);
      const priceRows = await this.resolvePrices(manager, body.prices ?? []);
      const roomType = await this.resolveRoomType(manager, body.roomTypeId);
      const listingSource = await this.resolveListingSource(manager, body.listingSourceCode);

      const property = await manager.findOne(PropertyEntity, { where: { id: propertyId } });
      const originLat = body.latitude ?? (property?.latitude == null ? null : Number(property.latitude));
      const originLng = body.longitude ?? (property?.longitude == null ? null : Number(property.longitude));
      const nearbyPlaces = (body.nearbyPlaces ?? existing?.nearby_places ?? []) as NearbyPlace[];
      if (nearbyPlaces.length && !validCoordinates(originLat, originLng)) throw new BadRequestException('Property coordinates required for nearby places');
      const savedNearby = nearbyPlaces.map((p) => ({ ...p, name: p.name.trim(),
        distanceMeters: distanceMeters(originLat!, originLng!, p.latitude, p.longitude),
      })).sort((a, b) => a.distanceMeters - b.distanceMeters);
      const status = await manager.findOne(MasterRoomStatusEntity, {
        where: { code: 'available' },
      });
      if (!status) {
        throw new BadRequestException('master_room_statuses.available missing — run create-room schema');
      }

      const room = manager.create(RentRoomEntity, {
        ...(existing ? { id: existing.id } : {}),
        room_id: body.roomId ?? null,
        listing_title: body.listingTitle!.trim(),
        promo_title:
          body.promoTitle !== undefined
            ? body.promoTitle.trim() || null
            : existing?.promo_title ?? null,
        listing_description:
          body.listingDescription !== undefined
            ? body.listingDescription
            : existing?.listing_description ?? null,
        available_from_date: body.availableFromDate ?? existing?.available_from_date ?? new Date().toISOString().slice(0, 10),
        prices: priceRows.map((row) => ({
          contractTypeId: row.contractType.id,
          contractTypeCode: row.contractType.code,
          price: row.price,
          advanceRentMonths: row.advanceRentMonths ?? existing?.prices?.find((p) => Number(p.contractTypeId) === row.contractType.id)?.advanceRentMonths ?? body.advanceRentMonths ?? existing?.advance_rent_months ?? 1,
          depositMonths: row.depositMonths ?? existing?.prices?.find((p) => Number(p.contractTypeId) === row.contractType.id)?.depositMonths ?? body.depositMonths ?? existing?.deposit_months ?? 2,
        })),
        custom_facilities: body.customFacilities ?? existing?.custom_facilities ?? [],
        latitude: body.latitude != null ? String(body.latitude) : null,
        longitude: body.longitude != null ? String(body.longitude) : null,
        nearby_other: body.nearbyOther ?? existing?.nearby_other ?? null,
        nearby_places: savedNearby,
        water_rate_per_unit:
          body.waterRatePerUnit != null && Number(body.waterRatePerUnit) > 0
            ? String(body.waterRatePerUnit)
            : null,
        electric_rate_per_unit:
          body.electricRatePerUnit != null && Number(body.electricRatePerUnit) > 0
            ? String(body.electricRatePerUnit)
            : null,
        advance_rent_months: body.advanceRentMonths ?? 1,
        deposit_months: body.depositMonths ?? 2,
        is_scout_room: true,
        visibility: body.visibility!,
        created_by_user_id: agent.id,
        property_owner_id: null,
        owner_id: null,
        properties_id: propertyId,
        room_type_id: roomType.id,
        listing_source_id: listingSource.id,
        room_status_id: existing?.room_status_id ?? status.id,
        view_count: existing?.view_count ?? 0,
      });
      const saved = await manager.save(room);
      if (existing) {
        await manager.delete(RentRoomPriceEntity, { rent_room_id: saved.id });
        await manager.delete(RoomLayoutValueEntity, { rent_room_id: saved.id });
        await manager.delete(RoomMediaEntity, { rent_id: saved.id });
        await manager.delete(RentRoomContactEntity, { rent_room_id: saved.id });
      }


      for (const row of priceRows) {
        await manager.save(
          manager.create(RentRoomPriceEntity, {
            rent_room_id: saved.id,
            contract_type_id: row.contractType.id,
            price: String(row.price),
          }),
        );
      }

      if (!existing) {
        await manager.delete(RentRoomContactEntity, { rent_room_id: saved.id });
      }
      for (let i = 0; i < contactIds.length; i++) {
        await manager.save(
          manager.create(RentRoomContactEntity, {
            rent_room_id: saved.id,
            contact_id: contactIds[i],
            is_primary: i === 0,
            role_code: 'contact',
          }),
        );
      }

      if (body.layout?.length) {
        const allowedLayout = new Set(['bedroom', 'bathroom', 'room_size', 'floor', 'building']);
        for (const item of body.layout) {
          if (!allowedLayout.has(item.code)) {
            throw new BadRequestException(`Unknown layout code: ${item.code}`);
          }
          let layout = await manager.findOne(MasterLayoutEntity, {
            where: { code: item.code },
          });
          if (!layout) {
            layout = await manager.save(
              manager.create(MasterLayoutEntity, { code: item.code }),
            );
          }
          await manager.save(
            manager.create(RoomLayoutValueEntity, {
              rent_room_id: saved.id,
              layout_id: layout.id,
              value: String(item.value),
            }),
          );
        }
      }

      if (existing && body.facilities !== undefined) {
        await manager.delete(RoomFacilityEntity, { rent_room_id: saved.id });
      }
      if (body.facilities?.length) {
        for (const item of body.facilities) {
          const facility = await manager.findOne(MasterFacilityEntity, {
            where: { code: item.code, ...(item.groupCode ? { group: { code: item.groupCode } } : {}) },
            relations: { group: true },
          });
          if (!facility) {
            throw new BadRequestException(`Unknown facility code: ${item.code}`);
          }
          await manager.save(
            manager.create(RoomFacilityEntity, {
              rent_room_id: saved.id,
              group_id: facility.group_id,
              f_id: facility.id,
            }),
          );
        }
      }

      let coverSet = false;
      for (let i = 0; i < body.medias!.length; i++) {
        const m = body.medias![i];
        const isCover = Boolean(m.isCover) && !coverSet;
        if (isCover) coverSet = true;
        await manager.save(
          manager.create(RoomMediaEntity, {
            rent_id: saved.id,
            media_url: m.mediaUrl,
            media_type: m.mediaType ?? 'image',
            category: m.category ?? 'room',
            is_cover: isCover,
            sort_order: m.sortOrder ?? i,
          }),
        );
      }
      if (!coverSet && body.medias!.length > 0) {
        await manager.query(
          `UPDATE room_medias SET is_cover = TRUE WHERE rent_id = $1 AND id = (
             SELECT id FROM room_medias WHERE rent_id = $1 ORDER BY sort_order ASC, id ASC LIMIT 1
           )`,
          [saved.id],
        );
      }

      if (existing && body.documents !== undefined) {
        await manager.delete(RentRoomDocumentEntity, { rent_id: saved.id });
      }
      if (body.documents?.length) {
        for (let i = 0; i < body.documents.length; i++) {
          const d = body.documents[i];
          await manager.save(
            manager.create(RentRoomDocumentEntity, {
              rent_id: saved.id,
              kind: d.kind,
              media_url: d.mediaUrl,
              sort_order: d.sortOrder ?? i,
            }),
          );
        }
      }

      return {
        id: saved.id,
        propertyId,
        contactId: contactIds[0],
        contactIds,
        listingSourceCode: listingSource.code,
        isScoutRoom: true,
        visibility: saved.visibility,
      };
    });
  }

  private validateCreateBody(body: CreateRoomBody) {
    validateRoomInput(body);
    if (body.nearbyPlaces !== undefined) validateNearbyPlaces(body.nearbyPlaces);
    if ((body.latitude !== undefined || body.longitude !== undefined) && !validCoordinates(body.latitude, body.longitude)) throw new BadRequestException('Valid latitude and longitude required');
    if (body.listingDescription !== undefined && (typeof body.listingDescription !== 'string' || body.listingDescription.length > 10000)) {
      throw new BadRequestException('listingDescription must be text up to 10000 characters');
    }
    if (body.promoTitle !== undefined && (typeof body.promoTitle !== 'string' || body.promoTitle.length > 255)) {
      throw new BadRequestException('promoTitle must be text up to 255 characters');
    }
    if (body.nearbyOther !== undefined && (typeof body.nearbyOther !== 'string' || body.nearbyOther.length > 500)) {
      throw new BadRequestException('nearbyOther must be text up to 500 characters');
    }
    if (body.availableFromDate !== undefined) {
      const date = body.availableFromDate;
      if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) {
        throw new BadRequestException('availableFromDate must be a valid YYYY-MM-DD date');
      }
    }
    if (body.customFacilities !== undefined && (!Array.isArray(body.customFacilities) || body.customFacilities.length > 50 || body.customFacilities.some((v) => typeof v !== 'string' || !v.trim() || v.length > 100))) {
      throw new BadRequestException('customFacilities must contain at most 50 names, up to 100 characters each');
    }
    if (body.facilities !== undefined && (!Array.isArray(body.facilities) || body.facilities.length > 100 || body.facilities.some((v) => !v || typeof v.code !== 'string' || !v.code.trim() || v.code.length > 64 || (v.groupCode !== undefined && (typeof v.groupCode !== 'string' || !v.groupCode.trim() || v.groupCode.length > 64))))) {
      throw new BadRequestException('Invalid facilities');
    }
    if (body.facilities && new Set(body.facilities.map((v) => `${v.groupCode ?? ''}:${v.code}`)).size !== body.facilities.length) {
      throw new BadRequestException('Duplicate facilities');
    }
    if (body.documents !== undefined) {
      if (!Array.isArray(body.documents) || body.documents.length > 20) throw new BadRequestException('At most 20 documents allowed');
      for (const document of body.documents) {
        if (!document || !['id_passport', 'bookbank', 'ownership', 'other'].includes(document.kind) || typeof document.mediaUrl !== 'string' || document.mediaUrl.length > 500) throw new BadRequestException('Invalid document');
        try {
          const url = new URL(document.mediaUrl);
          if (url.protocol !== 'https:' || !url.hostname) throw new Error();
        } catch { throw new BadRequestException('Document URL must be HTTPS'); }
      }
    }
    if (!body.visibility || !['private', 'published'].includes(body.visibility)) {
      throw new BadRequestException('visibility must be private or published');
    }
    const hasContactIds =
      Array.isArray(body.contactIds) && body.contactIds.length > 0;
    const hasContacts =
      Array.isArray(body.contacts) && body.contacts.length > 0;
    if (
      !hasContactIds &&
      !body.contactId &&
      !hasContacts &&
      !body.contact?.name?.trim()
    ) {
      throw new BadRequestException(
        'contactIds, contactId, contacts, or contact{name,phone} required',
      );
    }
    if (hasContactIds) {
      if (body.contactIds!.length > 2) {
        throw new BadRequestException('At most 2 contacts per room');
      }
      if (
        body.contactIds!.some(
          (id) => !Number.isSafeInteger(id) || id < 1,
        )
      ) {
        throw new BadRequestException('Invalid contactIds');
      }
      if (new Set(body.contactIds).size !== body.contactIds!.length) {
        throw new BadRequestException('Duplicate contactIds');
      }
    }
    if (hasContacts) {
      if (body.contacts!.length > 2) {
        throw new BadRequestException('At most 2 contacts per room');
      }
      for (const row of body.contacts!) {
        if (!row?.name?.trim() || !row?.phone?.trim()) {
          throw new BadRequestException('Each contact needs name and phone');
        }
      }
    }
    if (
      !hasContactIds &&
      !body.contactId &&
      !hasContacts &&
      !body.contact?.phone?.trim()
    ) {
      throw new BadRequestException('contact.phone required');
    }
    const pendingNew =
      (hasContacts ? body.contacts!.length : 0) +
      (!hasContacts && body.contact?.name?.trim() ? 1 : 0);
    const pendingIds =
      (hasContactIds ? body.contactIds!.length : 0) +
      (!hasContactIds && body.contactId ? 1 : 0);
    if (pendingNew + pendingIds > 2) {
      throw new BadRequestException('At most 2 contacts per room');
    }
    if (!body.propertyId && !body.property?.address?.trim()) {
      throw new BadRequestException('propertyId or property{address,district,province} required');
    }
    if (!body.propertyId) {
      if (!body.property?.district?.trim() || !body.property?.province?.trim()) {
        throw new BadRequestException('property.district and property.province required');
      }
      if (!body.property?.propertyTypeId) {
        throw new BadRequestException('property.propertyTypeId required');
      }
    }
    if (!body.listingTitle?.trim()) {
      throw new BadRequestException('listingTitle is required');
    }
    if (!body.roomTypeId) {
      throw new BadRequestException('roomTypeId is required');
    }
    if (!body.listingSourceCode || !['co_agent', 'owner'].includes(body.listingSourceCode)) {
      throw new BadRequestException('listingSourceCode must be co_agent or owner');
    }
    const bedroom = layoutValue(body.layout, 'bedroom');
    const bathroom = layoutValue(body.layout, 'bathroom');
    if (!isFilledCount(bedroom)) {
      throw new BadRequestException('layout bedroom is required');
    }
    if (!isFilledCount(bathroom)) {
      throw new BadRequestException('layout bathroom is required');
    }
    if (!body.prices?.length) {
      throw new BadRequestException('prices must have at least 1 row');
    }
    for (const p of body.prices) {
      for (const key of ['advanceRentMonths', 'depositMonths'] as const) {
        const value = p[key];
        if (value != null && (!Number.isInteger(value) || value < 0 || value > 12)) {
          throw new BadRequestException(`${key} must be an integer between 0 and 12 for each lease`);
        }
      }
      if (!p.contractTypeId || !(p.price > 0)) {
        throw new BadRequestException('each price needs contractTypeId and price > 0');
      }
    }
    if (new Set(body.prices.map((p) => p.contractTypeId)).size !== body.prices.length) {
      throw new BadRequestException('contractTypeId must be unique per room');
    }
    if (body.waterRatePerUnit != null && !(Number(body.waterRatePerUnit) > 0)) {
      throw new BadRequestException('waterRatePerUnit must be > 0 when provided');
    }
    if (body.electricRatePerUnit != null && !(Number(body.electricRatePerUnit) > 0)) {
      throw new BadRequestException('electricRatePerUnit must be > 0 when provided');
    }
    if (body.advanceRentMonths != null && !Number.isInteger(body.advanceRentMonths)) {
      throw new BadRequestException('advanceRentMonths must be an integer');
    }
    if (
      body.advanceRentMonths != null &&
      (body.advanceRentMonths < 0 || body.advanceRentMonths > 12)
    ) {
      throw new BadRequestException('advanceRentMonths must be between 0 and 12');
    }
    if (body.depositMonths != null && !Number.isInteger(body.depositMonths)) {
      throw new BadRequestException('depositMonths must be an integer');
    }
    if (body.depositMonths != null && (body.depositMonths < 0 || body.depositMonths > 12)) {
      throw new BadRequestException('depositMonths must be between 0 and 12');
    }
    if ((body.medias?.length ?? 0) > 12) throw new BadRequestException('At most 12 room photos allowed');
    const roomMedias = (body.medias ?? []).filter((m) => (m.category ?? 'room') === 'room');
    if (body.visibility === 'published' && roomMedias.length < 5) {
      throw new BadRequestException('medias must include at least 5 items with category room');
    }
    for (const m of body.medias ?? []) {
      if (!m.mediaUrl?.trim()) {
        throw new BadRequestException('each media needs mediaUrl');
      }
    }
  }

  private async resolveContactIds(
    manager: DataSource['manager'],
    agentId: number,
    body: CreateRoomBody,
  ): Promise<number[]> {
    const ids: number[] = [];

    const pushExisting = async (contactId: number) => {
      const existing = await manager.findOne(ContactEntity, {
        where: { id: contactId, created_by_user_id: agentId },
      });
      if (!existing) {
        throw new NotFoundException('contactId not found for this agent');
      }
      if (!ids.includes(existing.id)) ids.push(existing.id);
    };

    const pushNew = async (input: CreateRoomContactInput) => {
      const phone = input.phone.trim();
      const reused = await manager.findOne(ContactEntity, {
        where: { created_by_user_id: agentId, phone },
      });
      if (reused) {
        reused.name = input.name.trim();
        reused.email = input.email ?? reused.email;
        reused.line_id = input.lineId !== undefined ? input.lineId.trim() || null : reused.line_id;
        reused.facebook =
          input.facebook !== undefined ? input.facebook.trim() || null : reused.facebook;
        reused.note = input.note ?? reused.note;
        await manager.save(reused);
        if (!ids.includes(reused.id)) ids.push(reused.id);
        return;
      }
      const created = await manager.save(
        manager.create(ContactEntity, {
          name: input.name.trim(),
          phone,
          email: input.email ?? null,
          line_id: input.lineId?.trim() || null,
          facebook: input.facebook?.trim() || null,
          note: input.note ?? null,
          created_by_user_id: agentId,
        }),
      );
      if (!ids.includes(created.id)) ids.push(created.id);
    };

    if (body.contactIds?.length) {
      for (const id of body.contactIds) await pushExisting(id);
    } else if (body.contactId) {
      await pushExisting(body.contactId);
    }

    if (body.contacts?.length) {
      for (const row of body.contacts) await pushNew(row);
    } else if (body.contact?.name?.trim() && body.contact?.phone?.trim()) {
      await pushNew(body.contact);
    }

    if (!ids.length) {
      throw new BadRequestException('At least one contact is required');
    }
    if (ids.length > 2) {
      throw new BadRequestException('At most 2 contacts per room');
    }
    return ids;
  }

  private async resolveContactId(
    manager: DataSource['manager'],
    agentId: number,
    body: CreateRoomBody,
  ): Promise<number> {
    const ids = await this.resolveContactIds(manager, agentId, body);
    return ids[0];
  }

  private async resolveRoomType(
    manager: DataSource['manager'],
    roomTypeId: number | undefined,
  ) {
    if (!roomTypeId) {
      throw new BadRequestException('roomTypeId is required');
    }
    const roomType = await manager.findOne(MasterRoomTypeEntity, {
      where: { id: roomTypeId, is_active: true },
    });
    if (!roomType) {
      throw new BadRequestException('roomTypeId not found');
    }
    return roomType;
  }

  private async resolveListingSource(
    manager: DataSource['manager'],
    listingSourceCode: string | undefined,
  ) {
    if (!listingSourceCode) {
      throw new BadRequestException('listingSourceCode is required');
    }
    const source = await manager.findOne(MasterListingSourceEntity, {
      where: { code: listingSourceCode, is_active: true },
    });
    if (!source) {
      throw new BadRequestException('listingSourceCode not found');
    }
    return source;
  }

  private async resolvePrices(
    manager: DataSource['manager'],
    prices: Array<{ contractTypeId: number; price: number; advanceRentMonths?: number; depositMonths?: number }>,
  ) {
    const ids = [...new Set(prices.map((row) => row.contractTypeId))];
    const types = await manager.find(MasterContractTypeEntity, {
      where: { id: In(ids), is_active: true },
    });
    const byId = new Map(types.map((row) => [row.id, row]));
    return prices.map((row) => {
      const contractType = byId.get(row.contractTypeId);
      if (!contractType) {
        throw new BadRequestException(`Unknown contractTypeId: ${row.contractTypeId}`);
      }
      return { contractType, price: row.price, advanceRentMonths: row.advanceRentMonths, depositMonths: row.depositMonths };
    });
  }

  private async resolvePropertyForSave(manager: DataSource['manager'], body: CreateRoomBody, existing: RentRoomEntity | null) {
    if (existing && body.property && !body.propertyId) {
      const current = await manager.findOne(PropertyEntity, { where: { id: existing.properties_id } });
      const p = body.property;
      if (current && current.name === (p.name?.trim() || p.address.trim().slice(0, 80)) &&
        current.property_type_id === p.propertyTypeId && current.address === p.address.trim() &&
        current.district === p.district.trim() && current.province === p.province.trim() &&
        current.subdistrict === (p.subdistrict?.trim() || '-') && current.postal_code === (p.postalCode?.trim() || '-') &&
        (current.latitude == null ? null : Number(current.latitude)) === (p.latitude ?? null) &&
        (current.longitude == null ? null : Number(current.longitude)) === (p.longitude ?? null)) return current.id;
      // Changed address gets its own property; never mutate a property shared by another room.
    }
    return this.resolvePropertyId(manager, body);
  }

  private async resolvePropertyId(
    manager: DataSource['manager'],
    body: CreateRoomBody,
  ): Promise<number> {
    if (body.propertyId) {
      const existing = await manager.findOne(PropertyEntity, {
        where: { id: body.propertyId },
      });
      if (!existing) {
        throw new NotFoundException('propertyId not found');
      }
      return existing.id;
    }

    const p = body.property!;
    const propertyType = await manager.findOne(MasterPropertyTypeEntity, {
      where: { id: p.propertyTypeId },
    });
    if (!propertyType) {
      throw new BadRequestException('property.propertyTypeId not found');
    }

    const created = await manager.save(
      manager.create(PropertyEntity, {
        name: p.name?.trim() || p.address.trim().slice(0, 80),
        property_type_id: propertyType.id,
        address: p.address.trim(),
        subdistrict: p.subdistrict?.trim() || '-',
        district: p.district.trim(),
        province: p.province.trim(),
        postal_code: p.postalCode?.trim() || '-',
        latitude: p.latitude != null ? String(p.latitude) : null,
        longitude: p.longitude != null ? String(p.longitude) : null,
      }),
    );
    return created.id;
  }
}

function layoutValue(
  layout: Array<{ code: string; value: string }> | undefined,
  code: string,
) {
  return layout?.find((row) => row.code === code)?.value?.trim() ?? '';
}

function isFilledCount(value: string) {
  return /^\d+$/.test(value);
}
