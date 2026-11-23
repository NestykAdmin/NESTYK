import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';
import type { NearbyPlace } from '@nestyk/types';
import { distanceMeters, validCoordinates } from '../../agent/places/nearby-places';
import { bangkokToday } from '../../billing/rent-schedule';
import { PropertyEntity } from '../../entities/property.entity';
import { MasterPropertyTypeEntity } from '../../entities/master-property-type.entity';
import { MasterContractTypeEntity } from '../../entities/master-contract-type.entity';
import { MasterRoomTypeEntity } from '../../entities/master-room-type.entity';
import { MasterRoomStatusEntity } from '../../entities/master-room-status.entity';
import { MasterFacilityEntity } from '../../entities/master-facility.entity';
import { SelfOwnerRoomEntity } from '../../entities/self-owner-room.entity';
import { SelfOwnerRoomPriceEntity } from '../../entities/self-owner-room-price.entity';
import { SelfOwnerRoomMediaEntity } from '../../entities/self-owner-room-media.entity';
import { SelfOwnerRoomFacilityEntity } from '../../entities/self-owner-room-facility.entity';
import { MIN_PUBLISHED_PHOTOS, SelfOwnerRoomBody, validateSelfOwnerRoomBody } from './self-owner-room-input';

/** The agent's photo storage, injected by token so this module (and its tests) need not load sharp. */
export const SELF_OWNER_ROOM_PHOTOS = Symbol('SELF_OWNER_ROOM_PHOTOS');
export interface SelfOwnerRoomPhotos {
  validateRoomPhotos(userId: number, medias: Array<{ mediaUrl: string }>, baseUrl: string): Promise<void>;
  upload(userId: number, file: { buffer: Buffer; size: number } | undefined, baseUrl: string): Promise<unknown>;
}

type Owner = { id: number };
export type SelfOwnerRoomState = 'occupied' | 'listed' | 'unlisted';
export type SelfOwnerVisibility = 'private' | 'published';

const FACILITY_GROUPS = new Set(['furniture', 'appliances', 'room_features', 'parking', 'project_facilities', 'security_services']);
const blankToNull = (v: string | undefined | null) => (v?.trim() ? v.trim() : null);
const dash = (v: string | undefined) => v?.trim() || '-';
const undash = (v: string | null | undefined) => (v && v !== '-' ? v : undefined);
const num = (v: string | null | undefined) => (v == null ? null : Number(v));
const amount = (v: number | null | undefined) => (v != null && Number(v) > 0 ? String(v) : null);

/** Refusals the owner can act on; the app shows its own words for each (body `code`). */
export type SelfOwnerRoomErrorCode = 'PUBLISH_NEEDS_PHOTOS' | 'ROOM_RENTED' | 'LISTED_ROOM_NEEDS_PHOTOS';

/**
 * Rooms an owner lists without an agent (D4, 20 Nov 2026): kept in self_owner_* tables, apart from rent_rooms.
 * Every read and write is scoped to the signed-in owner; another owner's room answers 404.
 */
@Injectable()
export class SelfOwnerRoomsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(SELF_OWNER_ROOM_PHOTOS) private readonly photos: SelfOwnerRoomPhotos,
  ) {}

  async options() {
    const m = this.dataSource.manager;
    const [propertyTypes, contractTypes, roomTypes, facilities] = await Promise.all([
      m.find(MasterPropertyTypeEntity, { order: { id: 'ASC' } }),
      m.find(MasterContractTypeEntity, { where: { is_active: true }, order: { sort_order: 'ASC', id: 'ASC' } }),
      m.find(MasterRoomTypeEntity, { where: { is_active: true }, order: { sort_order: 'ASC', id: 'ASC' } }),
      m.find(MasterFacilityEntity, { relations: { group: true }, order: { group: { sort_order: 'ASC', id: 'ASC' }, sort_order: 'ASC', id: 'ASC' } }),
    ]);
    return {
      propertyTypes: propertyTypes.map((r) => ({ id: r.id, code: r.code })),
      contractTypes: contractTypes.map((r) => ({ id: r.id, code: r.code, termMonths: r.term_months })),
      roomTypes: roomTypes.map((r) => ({ id: r.id, code: r.code, bedroomCount: r.bedroom_count })),
      facilities: facilities.filter((r) => FACILITY_GROUPS.has(r.group?.code ?? ''))
        .map((r) => ({ code: r.code, groupCode: r.group.code, isExtraCharge: r.is_extra_charge })),
    };
  }

  /** My rooms, last changed first, as the rooms page lists them. */
  async list(owner: Owner) {
    const m = this.dataSource.manager;
    const rooms = await m.find(SelfOwnerRoomEntity, { where: { owner_user_id: owner.id }, order: { updated_at: 'DESC', id: 'DESC' } });
    if (!rooms.length) return [];
    const ids = rooms.map((r) => r.id);
    const [properties, prices, covers, contractTypes, statuses] = await Promise.all([
      m.find(PropertyEntity, { where: { id: In([...new Set(rooms.map((r) => r.properties_id))]) } }),
      m.find(SelfOwnerRoomPriceEntity, { where: { room_id: In(ids) }, order: { id: 'ASC' } }),
      m.find(SelfOwnerRoomMediaEntity, { where: { room_id: In(ids), is_cover: true } }),
      m.find(MasterContractTypeEntity),
      this.statusCodes(m),
    ]);
    const yearTypes = new Set(contractTypes.filter((c) => c.term_months === 12).map((c) => c.id));
    return rooms.map((room) => {
      const own = prices.filter((p) => p.room_id === room.id);
      const rent = own.find((p) => yearTypes.has(p.contract_type_id)) ?? own[0];
      return {
        id: room.id,
        title: room.room_name,
        project: properties.find((p) => p.id === room.properties_id)?.name ?? '',
        monthlyRent: rent ? Number(rent.price) : 0,
        state: roomState(room, statuses),
        visibility: room.visibility,
        bedrooms: room.bedrooms,
        sizeSqm: num(room.size_sqm),
        coverUrl: covers.find((c) => c.room_id === room.id)?.media_url ?? null,
        updatedAt: new Date(room.updated_at).toISOString(),
      };
    });
  }

  /** One of my rooms as the listing form's data, for editing and the detail view. */
  async detail(owner: Owner, id: number) {
    const m = this.dataSource.manager;
    const room = await this.ownRoom(m, owner, id);
    const [property, prices, medias, links, statuses] = await Promise.all([
      m.findOne(PropertyEntity, { where: { id: room.properties_id } }),
      m.find(SelfOwnerRoomPriceEntity, { where: { room_id: room.id }, order: { id: 'ASC' } }),
      m.find(SelfOwnerRoomMediaEntity, { where: { room_id: room.id }, order: { sort_order: 'ASC', id: 'ASC' } }),
      m.find(SelfOwnerRoomFacilityEntity, { where: { room_id: room.id }, order: { id: 'ASC' } }),
      this.statusCodes(m),
    ]);
    const facilities = links.length
      ? await m.find(MasterFacilityEntity, { where: { id: In(links.map((l) => l.facility_id)) }, relations: { group: true } })
      : [];
    const layout = [
      { code: 'bedroom', value: String(room.bedrooms) },
      { code: 'bathroom', value: String(room.bathrooms) },
      { code: 'room_size', value: room.size_sqm == null ? null : String(Number(room.size_sqm)) },
      { code: 'floor', value: room.floor },
      { code: 'building', value: room.building },
    ].filter((row): row is { code: string; value: string } => row.value != null && row.value !== '');
    return {
      id: room.id,
      state: roomState(room, statuses),
      visibility: room.visibility,
      listingSourceCode: 'owner',
      listingTitle: room.room_name,
      roomId: room.room_number ?? undefined,
      roomTypeId: room.room_type_id ?? undefined,
      property: property && {
        name: property.name,
        address: property.address,
        subdistrict: undash(property.subdistrict),
        district: property.district,
        province: property.province,
        postalCode: undash(property.postal_code),
        propertyTypeId: property.property_type_id ?? undefined,
        latitude: num(property.latitude) ?? undefined,
        longitude: num(property.longitude) ?? undefined,
      },
      layout,
      prices: prices.map((p) => ({ contractTypeId: p.contract_type_id, price: Number(p.price), advanceRentMonths: p.advance_rent_months, depositMonths: p.deposit_months })),
      advanceRentMonths: room.advance_rent_months,
      depositMonths: room.deposit_months,
      waterRatePerUnit: num(room.water_rate_per_unit),
      electricRatePerUnit: num(room.electric_rate_per_unit),
      availableFromDate: String(room.available_from_date).slice(0, 10),
      latitude: num(room.latitude) ?? undefined,
      longitude: num(room.longitude) ?? undefined,
      facilities: links.map((l) => facilities.find((f) => f.id === l.facility_id))
        .filter((f): f is MasterFacilityEntity => !!f)
        .map((f) => ({ code: f.code, groupCode: f.group?.code })),
      customFacilities: room.custom_facilities ?? [],
      nearbyPlaces: room.nearby_places ?? [],
      medias: medias.map((md) => ({ mediaUrl: md.media_url, mediaType: 'image' as const, category: 'room' as const, isCover: md.is_cover, sortOrder: md.sort_order })),
      promoTitle: room.promo_title ?? undefined,
      listingDescription: room.listing_description ?? undefined,
      contact: { name: room.contact_name, phone: room.contact_phone, lineId: room.contact_line_id ?? undefined, facebook: room.contact_facebook ?? undefined },
      updatedAt: new Date(room.updated_at).toISOString(),
    };
  }

  /** A new room starts unlisted and available; listing it is its own step (setVisibility). */
  create(owner: Owner, body: SelfOwnerRoomBody, baseUrl = '') {
    return this.save(owner, body, baseUrl);
  }

  /** Replaces the room's form data; whether it is listed stays as it was. */
  update(owner: Owner, id: number, body: SelfOwnerRoomBody, baseUrl = '') {
    return this.save(owner, body, baseUrl, id);
  }

  async setVisibility(owner: Owner, id: number, visibility: unknown) {
    if (visibility !== 'private' && visibility !== 'published') throw new BadRequestException('visibility must be private or published');
    return this.dataSource.transaction(async (m) => {
      const room = await this.ownRoom(m, owner, id, true);
      const statuses = await this.statusCodes(m);
      if (statuses.get(room.room_status_id) === 'rented') {
        throw new ConflictException({ code: 'ROOM_RENTED', message: 'A rented room cannot be listed or unlisted' });
      }
      if (visibility === 'published') {
        const photos = await m.find(SelfOwnerRoomMediaEntity, { where: { room_id: room.id } });
        if (photos.length < MIN_PUBLISHED_PHOTOS) {
          throw new BadRequestException({ code: 'PUBLISH_NEEDS_PHOTOS', message: `At least ${MIN_PUBLISHED_PHOTOS} room photos are needed to list a room` });
        }
      }
      const saved = await m.save(SelfOwnerRoomEntity, { ...room, visibility });
      return { id: saved.id, visibility: saved.visibility, state: roomState(saved, statuses) };
    });
  }

  upload(owner: Owner, file: { buffer: Buffer; size: number } | undefined, baseUrl: string) {
    return this.photos.upload(owner.id, file, baseUrl);
  }

  private async save(owner: Owner, body: SelfOwnerRoomBody, baseUrl: string, existingId?: number) {
    validateSelfOwnerRoomBody(body);
    const medias = body.medias ?? [];
    return this.dataSource.transaction(async (m) => {
      const existing = existingId == null ? null : await this.ownRoom(m, owner, existingId, true);
      // Every check and lookup runs before the first write.
      const oldUrls = new Set(existing ? (await m.find(SelfOwnerRoomMediaEntity, { where: { room_id: existing.id } })).map((md) => md.media_url) : []);
      await this.photos.validateRoomPhotos(owner.id, medias.filter((md) => !oldUrls.has(md.mediaUrl)), baseUrl);
      if (existing?.visibility === 'published' && medias.length < MIN_PUBLISHED_PHOTOS) {
        throw new BadRequestException({ code: 'LISTED_ROOM_NEEDS_PHOTOS', message: `A listed room needs at least ${MIN_PUBLISHED_PHOTOS} photos; unlist it first` });
      }
      const statuses = await this.statusCodes(m);
      const available = [...statuses].find(([, code]) => code === 'available')?.[0];
      if (available == null) throw new BadRequestException('master_room_statuses.available missing');
      const roomType = body.roomTypeId == null ? null : await m.findOne(MasterRoomTypeEntity, { where: { id: body.roomTypeId, is_active: true } });
      if (body.roomTypeId != null && !roomType) throw new BadRequestException('roomTypeId not found');
      const contractTypes = await m.find(MasterContractTypeEntity, { where: { id: In(body.prices.map((p) => p.contractTypeId)), is_active: true } });
      const unknownPrice = body.prices.find((p) => !contractTypes.some((c) => c.id === p.contractTypeId));
      if (unknownPrice) throw new BadRequestException(`Unknown contractTypeId: ${unknownPrice.contractTypeId}`);
      const facilityIds: number[] = [];
      for (const item of body.facilities ?? []) {
        // Only the catalog groups the form offers (options()); the same code in another group does not count.
        const facility = (await m.find(MasterFacilityEntity, {
          where: { code: item.code, ...(item.groupCode ? { group: { code: item.groupCode } } : {}) },
          relations: { group: true },
          order: { id: 'ASC' },
        })).find((f) => FACILITY_GROUPS.has(f.group?.code ?? ''));
        if (!facility) throw new BadRequestException(`Unknown facility code: ${item.code}`);
        if (!facilityIds.includes(facility.id)) facilityIds.push(facility.id);
      }
      const p = body.property;
      const propertyType = await m.findOne(MasterPropertyTypeEntity, { where: { id: p.propertyTypeId } });
      if (!propertyType) throw new BadRequestException('property.propertyTypeId not found');
      const lat = body.latitude ?? p.latitude ?? null;
      const lng = body.longitude ?? p.longitude ?? null;
      const nearby = (body.nearbyPlaces ?? existing?.nearby_places ?? []) as NearbyPlace[];
      if (nearby.length && !validCoordinates(lat, lng)) throw new BadRequestException('Property coordinates required for nearby places');

      const propertyId = await this.resolveProperty(m, body.property, existing);
      const layout = new Map(body.layout.map((row) => [row.code, String(row.value ?? '').trim()]));
      const saved = await m.save(SelfOwnerRoomEntity, {
        ...(existing ?? {}),
        owner_user_id: owner.id,
        properties_id: propertyId,
        room_type_id: roomType?.id ?? null,
        room_status_id: existing?.room_status_id ?? available,
        visibility: existing?.visibility ?? 'private',
        room_name: body.listingTitle.trim(),
        room_number: blankToNull(body.roomId),
        bedrooms: Number(layout.get('bedroom')),
        bathrooms: Number(layout.get('bathroom')),
        size_sqm: layout.get('room_size') ? String(Number(layout.get('room_size'))) : null,
        floor: blankToNull(layout.get('floor')),
        building: blankToNull(layout.get('building')),
        // Today in Thailand: the database's CURRENT_DATE and toISOString are UTC (a day behind before 07:00).
        available_from_date: body.availableFromDate ?? existing?.available_from_date ?? bangkokToday(),
        advance_rent_months: body.advanceRentMonths ?? 1,
        deposit_months: body.depositMonths ?? 2,
        water_rate_per_unit: amount(body.waterRatePerUnit),
        electric_rate_per_unit: amount(body.electricRatePerUnit),
        latitude: lat == null ? null : String(lat),
        longitude: lng == null ? null : String(lng),
        custom_facilities: (body.customFacilities ?? []).map((v) => v.trim()),
        nearby_places: nearby.map((place) => ({ ...place, name: place.name.trim(), distanceMeters: distanceMeters(lat!, lng!, place.latitude, place.longitude) }))
          .sort((a, b) => a.distanceMeters - b.distanceMeters),
        promo_title: blankToNull(body.promoTitle),
        listing_description: body.listingDescription?.trim() ? body.listingDescription : null,
        contact_name: body.contact.name.trim(),
        contact_phone: body.contact.phone.trim(),
        contact_line_id: blankToNull(body.contact.lineId),
        contact_facebook: blankToNull(body.contact.facebook),
        // Set here: TypeORM bumps updated_at only when a room column changes, not for a price- or photo-only edit.
        updated_at: new Date(),
      });

      if (existing) {
        for (const entity of [SelfOwnerRoomPriceEntity, SelfOwnerRoomMediaEntity, SelfOwnerRoomFacilityEntity]) {
          await m.delete(entity, { room_id: saved.id });
        }
      }
      for (const row of body.prices) {
        await m.save(SelfOwnerRoomPriceEntity, {
          room_id: saved.id,
          contract_type_id: row.contractTypeId,
          price: String(row.price),
          advance_rent_months: row.advanceRentMonths ?? body.advanceRentMonths ?? 1,
          deposit_months: row.depositMonths ?? body.depositMonths ?? 2,
        });
      }
      for (const facility_id of facilityIds) await m.save(SelfOwnerRoomFacilityEntity, { room_id: saved.id, facility_id });
      const cover = Math.max(0, medias.findIndex((md) => md.isCover));
      for (let i = 0; i < medias.length; i++) {
        await m.save(SelfOwnerRoomMediaEntity, { room_id: saved.id, media_url: medias[i].mediaUrl, is_cover: i === cover, sort_order: medias[i].sortOrder ?? i });
      }
      return { id: saved.id, visibility: saved.visibility, state: roomState(saved, statuses) };
    });
  }

  /** Reuse the room's own property when the address is unchanged; a changed address gets a new one. */
  private async resolveProperty(m: EntityManager, p: SelfOwnerRoomBody['property'], existing: SelfOwnerRoomEntity | null) {
    const values = {
      name: p.name?.trim() || p.address.trim().slice(0, 80),
      property_type_id: p.propertyTypeId,
      address: p.address.trim(),
      subdistrict: dash(p.subdistrict),
      district: p.district.trim(),
      province: p.province.trim(),
      postal_code: dash(p.postalCode),
      latitude: p.latitude != null ? String(p.latitude) : null,
      longitude: p.longitude != null ? String(p.longitude) : null,
    };
    if (existing) {
      const current = await m.findOne(PropertyEntity, { where: { id: existing.properties_id } });
      if (current && current.name === values.name && current.property_type_id === values.property_type_id &&
        current.address === values.address && current.subdistrict === values.subdistrict && current.district === values.district &&
        current.province === values.province && current.postal_code === values.postal_code &&
        num(current.latitude) === (p.latitude ?? null) && num(current.longitude) === (p.longitude ?? null)) return current.id;
    }
    return (await m.save(PropertyEntity, values)).id;
  }

  private async ownRoom(m: EntityManager, owner: Owner, id: number, lock = false) {
    const room = await m.findOne(SelfOwnerRoomEntity, {
      where: { id, owner_user_id: owner.id },
      ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
    if (!room) throw new NotFoundException('Room not found');
    return room;
  }

  private async statusCodes(m: EntityManager) {
    return new Map((await m.find(MasterRoomStatusEntity)).map((s) => [s.id, s.code]));
  }
}

function roomState(room: Pick<SelfOwnerRoomEntity, 'room_status_id' | 'visibility'>, statuses: Map<number, string>): SelfOwnerRoomState {
  if (statuses.get(room.room_status_id) === 'rented') return 'occupied';
  return room.visibility === 'published' ? 'listed' : 'unlisted';
}
