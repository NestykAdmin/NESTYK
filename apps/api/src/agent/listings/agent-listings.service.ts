import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { RentRoomEntity } from '../../entities/rent-room.entity';

export type ListingsSort = 'updated_desc' | 'updated_asc' | 'price_asc' | 'price_desc';

export type ListingsQuery = {
  page?: number;
  limit?: number;
  q?: string;
  visibility?: string;
  roomStatus?: string;
  listingSource?: string;
  sort?: string;
  propertyType?: string;
  roomType?: string;
  bedrooms?: string;
  minPrice?: string;
  maxPrice?: string;
};

const MIN_PRICE_SUBQUERY =
  '(SELECT MIN(CAST(sortPrice.price AS DECIMAL)) FROM rent_room_prices sortPrice WHERE sortPrice.rent_room_id = room.id)';

function normalizeSort(raw: string | undefined): ListingsSort {
  if (raw === 'updated_asc' || raw === 'price_asc' || raw === 'price_desc') return raw;
  return 'updated_desc';
}

/** Room pin, falling back to its building; null unless both parts are valid numbers. */
function roomCoordinates(room: RentRoomEntity): { latitude: number | null; longitude: number | null } {
  for (const source of [room, room.property]) {
    const latitude = source?.latitude == null ? NaN : Number(source.latitude);
    const longitude = source?.longitude == null ? NaN : Number(source.longitude);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) return { latitude, longitude };
  }
  return { latitude: null, longitude: null };
}

function layoutValue(room: RentRoomEntity, code: string): string | null {
  return room.layout_values?.find((row) => row.layout?.code === code)?.value?.trim() ?? null;
}

function roomPrices(room: RentRoomEntity) {
  // Lease-specific conditions live beside prices in the existing JSON column.
  // Old rooms remain compatible through their room-level defaults.
  const terms = (id: number | undefined, code: string) => {
    const saved = (room.prices ?? []).find((item) =>
      (id != null && Number(item.contractTypeId) === id) || item.contractTypeCode === code);
    return {
      advanceRentMonths: Number(saved?.advanceRentMonths ?? room.advance_rent_months ?? 1),
      depositMonths: Number(saved?.depositMonths ?? room.deposit_months ?? 2),
    };
  };
  if (room.price_rows?.length) {
    return [...room.price_rows].sort((a, b) => (a.contract_type?.term_months ?? 0) - (b.contract_type?.term_months ?? 0)).map((row) => ({
      contractTypeId: row.contract_type_id,
      contractTypeCode: row.contract_type.code,
      termMonths: row.contract_type.term_months,
      price: Number(row.price),
      ...terms(row.contract_type_id, row.contract_type.code),
    }));
  }
  return (room.prices ?? []).filter((row) => typeof row.contractTypeCode === 'string' && Number.isFinite(Number(row.price))).map((row) => ({
    contractTypeId: Number(row.contractTypeId) || undefined,
    contractTypeCode: String(row.contractTypeCode),
    termMonths: Number(String(row.contractTypeCode).replace('monthly_', '')) || null,
    price: Number(row.price),
    ...terms(Number(row.contractTypeId) || undefined, String(row.contractTypeCode)),
  }));
}

export type MatchRoomFacts = {
  id: number;
  latitude: number | null;
  longitude: number | null;
  prices: Array<{ termMonths: number | null; price: number }>;
  roomTypeCode: string | null;
  availableFromDate: string | null;
};

export type ListingCard = ReturnType<typeof toListingCard>;

function toListingCard(room: RentRoomEntity) {
  const medias = [...(room.medias ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const cover = medias.find((m) => m.is_cover) ?? medias[0];
  const primaryContact =
    (room.room_contacts ?? []).find((link) => link.is_primary)?.contact ??
    room.room_contacts?.[0]?.contact ??
    null;

  return {
    id: room.id,
    listingTitle: room.listing_title,
    visibility: room.visibility,
    isScoutRoom: room.is_scout_room,
    listingSourceCode: room.listing_source?.code ?? null,
    roomStatusCode: room.room_status?.code ?? null,
    property: room.property
      ? {
          id: room.property.id,
          name: room.property.name,
          district: room.property.district,
          province: room.property.province,
        }
      : null,
    contact: primaryContact
      ? {
          id: primaryContact.id,
          name: primaryContact.name,
          phone: primaryContact.phone,
        }
      : null,
    propertyOwner: room.property_owner
      ? {
          id: room.property_owner.id,
          name: room.property_owner.name,
          phone: room.property_owner.phone,
        }
      : null,
    prices: roomPrices(room),
    coverMediaUrl: cover?.media_url ?? null,
    roomTypeCode: room.room_type?.code ?? null,
    availableFromDate: room.available_from_date ?? null,
    bedroomCount:
      layoutValue(room, 'bedroom') ??
      (room.room_type?.bedroom_count != null ? String(room.room_type.bedroom_count) : null),
    roomSizeSqm: layoutValue(room, 'room_size'),
    floor: layoutValue(room, 'floor'),
    ...roomCoordinates(room),
    updatedAt: room.updated_at?.toISOString?.() ?? null,
  };
}

@Injectable()
export class AgentListingsService {
  constructor(
    @InjectRepository(RentRoomEntity)
    private readonly roomsRepo: Repository<RentRoomEntity>,
  ) {}

  async listMine(agentId: number, query: ListingsQuery) {
    const page = Math.max(1, Math.floor(Number.isFinite(Number(query.page)) ? Number(query.page) || 1 : 1));
    const limit = Math.min(50, Math.max(1, Math.floor(Number.isFinite(Number(query.limit)) ? Number(query.limit) || 20 : 20)));

    const countQb = this.roomsRepo
      .createQueryBuilder('room')
      .leftJoin('room.property', 'property')
      .leftJoin('room.room_contacts', 'roomContact')
      .leftJoin('roomContact.contact', 'contact')
      .leftJoin('room.room_status', 'roomStatus')
      .leftJoin('room.listing_source', 'listingSource')
      .where('room.is_scout_room = TRUE')
      .andWhere('room.created_by_user_id = :agentId', { agentId });

    if (query.visibility === 'private' || query.visibility === 'published') {
      countQb.andWhere('room.visibility = :visibility', { visibility: query.visibility });
    }

    const statusCode = query.roomStatus?.trim();
    if (statusCode) {
      countQb.andWhere('roomStatus.code = :roomStatus', { roomStatus: statusCode });
    }

    const sourceCode = query.listingSource?.trim();
    if (sourceCode === 'owner' || sourceCode === 'co_agent') {
      countQb.andWhere('listingSource.code = :listingSource', { listingSource: sourceCode });
    }

    const search = query.q?.trim();
    if (query.propertyType) {
      countQb.leftJoin('property.property_type', 'filterPropertyType')
        .andWhere('filterPropertyType.code = :propertyType', { propertyType: query.propertyType });
    }
    if (query.roomType || query.bedrooms) {
      countQb.leftJoin('room.room_type', 'filterRoomType');
    }
    if (query.roomType) {
      countQb.andWhere('filterRoomType.code = :roomType', { roomType: query.roomType });
    }
    if (query.bedrooms) {
      if (!/^[0-4]$/.test(query.bedrooms)) throw new BadRequestException('Invalid bedrooms');
      const bedrooms = Number(query.bedrooms);
      const bedroomValue = `COALESCE((SELECT CASE WHEN TRIM(lv.value) ~ '^[0-9]+$' THEN CAST(TRIM(lv.value) AS NUMERIC) END FROM room_layout_values lv JOIN master_layouts ml ON ml.id = lv.layout_id WHERE lv.rent_room_id = room.id AND ml.code = 'bedroom' LIMIT 1), filterRoomType.bedroom_count)`;
      countQb.andWhere(`${bedroomValue} ${bedrooms === 4 ? '>=' : '='} :bedrooms`, { bedrooms });
    }
    const parsePrice = (value: string | undefined) => {
      if (value == null || value === '') return undefined;
      if (!/^\d+(\.\d{1,2})?$/.test(value) || !Number.isFinite(Number(value))) {
        throw new BadRequestException('Invalid price');
      }
      return Number(value);
    };
    const minPrice = parsePrice(query.minPrice);
    const maxPrice = parsePrice(query.maxPrice);
    if (minPrice != null && maxPrice != null && minPrice > maxPrice) {
      throw new BadRequestException('Minimum price exceeds maximum price');
    }
    // Match the displayed starting monthly rent, before counting and pagination.
    if (minPrice != null) countQb.andWhere(`${MIN_PRICE_SUBQUERY} >= :minPrice`, { minPrice });
    if (maxPrice != null) countQb.andWhere(`${MIN_PRICE_SUBQUERY} <= :maxPrice`, { maxPrice });
    if (search) {
      countQb.andWhere(
        '(property.name ILIKE :q OR room.listing_title ILIKE :q OR contact.name ILIKE :q OR contact.phone ILIKE :q)',
        { q: `%${search}%` },
      );
    }

    const total = await countQb.getCount();
    const sort = normalizeSort(query.sort);
    const idQb = countQb.clone().select('room.id', 'id');
    if (sort === 'price_asc' || sort === 'price_desc') {
      idQb.addSelect(MIN_PRICE_SUBQUERY, 'sort_key');
    } else {
      idQb.addSelect('MAX(room.updated_at)', 'sort_key');
    }
    idQb.groupBy('room.id');

    if (sort === 'updated_asc' || sort === 'price_asc') {
      idQb.orderBy(
        'sort_key',
        'ASC',
        sort.startsWith('price') ? 'NULLS LAST' : undefined,
      );
      idQb.addOrderBy('room.id', 'ASC');
    } else {
      idQb.orderBy(
        'sort_key',
        'DESC',
        sort.startsWith('price') ? 'NULLS LAST' : undefined,
      );
      idQb.addOrderBy('room.id', 'DESC');
    }

    const idRows = await idQb
      .offset((page - 1) * limit)
      .limit(limit)
      .getRawMany<{ id: number }>();
    const ids = idRows.map((row) => Number(row.id)).filter((id) => Number.isFinite(id));

    if (!ids.length) {
      return { items: [], total, page, limit };
    }

    return { items: await this.cardsByIds(agentId, ids), total, page, limit };
  }

  /** Listing cards for the agent's scout rooms, in the order of `ids`; missing rooms are skipped. */
  async cardsByIds(agentId: number, ids: number[]): Promise<ListingCard[]> {
    if (!ids.length) return [];
    const found = await this.roomsRepo.find({
      where: { id: In(ids), created_by_user_id: agentId, is_scout_room: true },
      relations: {
        price_rows: { contract_type: true },
        property: true,
        property_owner: true,
        listing_source: true,
        room_contacts: { contact: true },
        medias: true,
        room_status: true,
        room_type: true,
        layout_values: { layout: true },
      },
    });
    const byId = new Map(found.map((room) => [room.id, room]));
    return ids
      .map((id) => byId.get(id))
      .filter((room): room is RentRoomEntity => !!room)
      .map(toListingCard);
  }

  /**
   * Available scout rooms of the agent nobody has booked, inside any of the lat/lng boxes, whose starting rent fits the budget,
   * with just the facts scoring needs. Rooms priced only through the legacy JSON column are kept for the scorer.
   */
  async matchCandidates(
    agentId: number,
    filter: { maxPrice: number; boxes: Array<{ minLat: number; maxLat: number; minLng: number; maxLng: number }> },
  ): Promise<MatchRoomFacts[]> {
    if (!filter.boxes.length) return [];
    const lat = 'CAST(CASE WHEN room.latitude IS NOT NULL AND room.longitude IS NOT NULL THEN room.latitude ELSE property.latitude END AS DOUBLE PRECISION)';
    const lng = 'CAST(CASE WHEN room.latitude IS NOT NULL AND room.longitude IS NOT NULL THEN room.longitude ELSE property.longitude END AS DOUBLE PRECISION)';
    const params: Record<string, number> = { agentId, maxPrice: filter.maxPrice };
    const boxSql = filter.boxes.map((box, i) => {
      params[`minLat${i}`] = box.minLat;
      params[`maxLat${i}`] = box.maxLat;
      params[`minLng${i}`] = box.minLng;
      params[`maxLng${i}`] = box.maxLng;
      return `(${lat} BETWEEN :minLat${i} AND :maxLat${i} AND ${lng} BETWEEN :minLng${i} AND :maxLng${i})`;
    });
    const idRows = await this.roomsRepo
      .createQueryBuilder('room')
      .select('room.id', 'id')
      .leftJoin('room.property', 'property')
      .innerJoin('room.room_status', 'roomStatus')
      .where('room.is_scout_room = TRUE')
      .andWhere('room.created_by_user_id = :agentId')
      .andWhere("roomStatus.code = 'available'")
      // A room one of the agent's leads has booked is taken, whatever its status code still says.
      .andWhere("NOT EXISTS (SELECT 1 FROM leads booked WHERE booked.rent_room_id = room.id AND booked.status = 'booked')")
      .andWhere(`(${MIN_PRICE_SUBQUERY} IS NULL OR ${MIN_PRICE_SUBQUERY} <= :maxPrice)`)
      .andWhere(`(${boxSql.join(' OR ')})`)
      .setParameters(params)
      .getRawMany<{ id: number }>();
    const ids = idRows.map((row) => Number(row.id)).filter((id) => Number.isFinite(id));
    if (!ids.length) return [];
    const rooms = await this.roomsRepo.find({
      where: { id: In(ids), created_by_user_id: agentId, is_scout_room: true },
      relations: { price_rows: { contract_type: true }, property: true, room_type: true },
    });
    return rooms.map((room) => ({
      id: room.id,
      ...roomCoordinates(room),
      prices: roomPrices(room).map((p) => ({ termMonths: p.termMonths, price: p.price })),
      roomTypeCode: room.room_type?.code ?? null,
      availableFromDate: room.available_from_date ?? null,
    }));
  }
  async viewMine(agentId: number, id: number) {
    const room = await this.roomsRepo.findOne({
      where: { id, created_by_user_id: agentId, is_scout_room: true },
      relations: {
        property: { property_type: true }, room_type: true, room_status: true,
        listing_source: true, medias: true, price_rows: { contract_type: true },
        room_contacts: { contact: true }, layout_values: { layout: true },
        facilities: { facility: { group: true } }, documents: true,
      },
    });
    if (!room) throw new NotFoundException('Room not found');
    const p = room.property;
    return {
      id: room.id, listingTitle: room.listing_title, promoTitle: room.promo_title,
      description: room.listing_description,
      roomId: room.room_id, visibility: room.visibility,
      roomStatusCode: room.room_status?.code ?? null,
      roomTypeCode: room.room_type?.code ?? null, roomTypeId: room.room_type_id,
      listingSourceCode: room.listing_source?.code ?? null,
      availableFromDate: room.available_from_date,
      property: p ? { id: p.id, propertyTypeId: p.property_type_id, latitude: p.latitude, longitude: p.longitude, name: p.name, address: p.address, subdistrict: p.subdistrict,
        district: p.district, province: p.province, postalCode: p.postal_code,
        propertyTypeCode: p.property_type?.code ?? null } : null,
      latitude: room.latitude ?? p?.latitude ?? null,
      longitude: room.longitude ?? p?.longitude ?? null,
      prices: roomPrices(room), advanceRentMonths: room.advance_rent_months,
      depositMonths: room.deposit_months,
      waterRatePerUnit: room.water_rate_per_unit, electricRatePerUnit: room.electric_rate_per_unit,
      medias: [...(room.medias ?? [])].sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order || a.id - b.id)
        .map((m) => ({ id: m.id, mediaUrl: m.media_url, mediaType: m.media_type, isCover: m.is_cover })),
      layout: (room.layout_values ?? []).map((v) => ({ code: v.layout.code, value: v.value })),
      facilities: [...(room.facilities ?? []).map((f) => f.facility.code), ...(room.custom_facilities ?? [])],
      facilityItems: (room.facilities ?? []).map((f) => ({ code: f.facility.code, groupCode: f.facility.group?.code })),
      customFacilities: room.custom_facilities ?? [],
      nearbyPlaces: room.nearby_places ?? [],
      documents: [...(room.documents ?? [])].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
        .map((d) => ({ kind: d.kind, mediaUrl: d.media_url, sortOrder: d.sort_order })),
      nearbyOther: room.nearby_other,
      contacts: [...(room.room_contacts ?? [])].sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
        .filter((link) => link.contact?.created_by_user_id === agentId)
        .map((link) => ({ id: link.contact.id, name: link.contact.name, phone: link.contact.phone,
          email: link.contact.email, lineId: link.contact.line_id, facebook: link.contact.facebook,
          note: link.contact.note, isPrimary: link.is_primary })),
    };
  }

}
