import {
  BadRequestException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  createShareLinkToken,
  hashShareLinkToken,
  isPlausibleShareLinkToken,
  isShareLinkExpired,
  shareLinkExpiresAt,
} from '../../common/share-link-token';
import {
  RoomShareLinkEntity,
  type RoomShareSections,
} from '../../entities/room-share-link.entity';
import { RentRoomEntity } from '../../entities/rent-room.entity';
import { RentRoomContactEntity } from '../../entities/rent-room-contact.entity';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_EXPIRES_DAYS = 7;
const MIN_EXPIRES_DAYS = 1;
const MAX_EXPIRES_DAYS = 30;

const DEFAULT_SECTIONS: RoomShareSections = {
  photos: true,
  price: true,
  facilities: true,
  location: true,
  contact: true,
};

function normalizeSections(input: unknown): RoomShareSections {
  const src =
    input && typeof input === 'object' && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const next: RoomShareSections = { ...DEFAULT_SECTIONS };
  for (const key of Object.keys(DEFAULT_SECTIONS) as (keyof RoomShareSections)[]) {
    if (typeof src[key] === 'boolean') next[key] = src[key] as boolean;
  }
  return next;
}

function parseExpiresInDays(input: unknown): number {
  if (input == null || input === '') return DEFAULT_EXPIRES_DAYS;
  const n = typeof input === 'number' ? input : Number(input);
  if (!Number.isInteger(n) || n < MIN_EXPIRES_DAYS || n > MAX_EXPIRES_DAYS) {
    throw new BadRequestException(
      `expiresInDays must be an integer between ${MIN_EXPIRES_DAYS} and ${MAX_EXPIRES_DAYS}`,
    );
  }
  return n;
}

@Injectable()
export class RoomShareLinksService {
  constructor(
    @InjectRepository(RoomShareLinkEntity)
    private readonly linksRepo: Repository<RoomShareLinkEntity>,
    @InjectRepository(RentRoomEntity)
    private readonly roomsRepo: Repository<RentRoomEntity>,
    @InjectRepository(RentRoomContactEntity)
    private readonly roomContactsRepo: Repository<RentRoomContactEntity>,
  ) {}

  private publicWebBase() {
    return (
      process.env.PUBLIC_WEB_URL ||
      process.env.NEXT_PUBLIC_WEB_URL ||
      'http://localhost:3000'
    ).replace(/\/$/, '');
  }

  private async assertOwnedScoutRoom(agentId: number, roomId: number) {
    const room = await this.roomsRepo.findOne({
      where: { id: roomId, created_by_user_id: agentId, is_scout_room: true },
    });
    if (!room) throw new NotFoundException('Room not found');
    return room;
  }

  private async assertRoomContact(agentId: number, roomId: number, contactId: number) {
    const link = await this.roomContactsRepo
      .createQueryBuilder('rc')
      .innerJoinAndSelect('rc.contact', 'contact')
      .where('rc.rent_room_id = :roomId', { roomId })
      .andWhere('rc.contact_id = :contactId', { contactId })
      .andWhere('contact.created_by_user_id = :agentId', { agentId })
      .getOne();
    if (!link?.contact) throw new BadRequestException('contactId must belong to this room');
    return link.contact;
  }

  private statusOf(link: RoomShareLinkEntity, now = new Date()) {
    if (link.revoked_at) return 'revoked' as const;
    if (isShareLinkExpired(link.expires_at, now)) return 'expired' as const;
    return 'active' as const;
  }

  async create(agentId: number, roomId: number, body: unknown) {
    await this.assertOwnedScoutRoom(agentId, roomId);
    const input =
      body && typeof body === 'object' && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : {};
    const days = parseExpiresInDays(input.expiresInDays);
    const shareSections = normalizeSections(input.shareSections ?? input.share_sections);
    let contactId: number | null = null;
    if (input.contactId != null || input.contact_id != null) {
      const raw = input.contactId ?? input.contact_id;
      const id = typeof raw === 'number' ? raw : Number(raw);
      if (!Number.isInteger(id) || id <= 0 || id > 2147483647) {
        throw new BadRequestException('Invalid contactId');
      }
      await this.assertRoomContact(agentId, roomId, id);
      contactId = id;
    } else if (shareSections.contact) {
      const primary = await this.roomContactsRepo
        .createQueryBuilder('rc')
        .innerJoinAndSelect('rc.contact', 'contact')
        .where('rc.rent_room_id = :roomId', { roomId })
        .andWhere('contact.created_by_user_id = :agentId', { agentId })
        .orderBy('rc.is_primary', 'DESC')
        .addOrderBy('rc.id', 'ASC')
        .getOne();
      contactId = primary?.contact_id ?? null;
    }

    const token = createShareLinkToken();
    const expiresAt = shareLinkExpiresAt(days * DAY_MS);
    const saved = await this.linksRepo.save(
      this.linksRepo.create({
        rent_room_id: roomId,
        created_by_user_id: agentId,
        token_hash: hashShareLinkToken(token),
        expires_at: expiresAt,
        revoked_at: null,
        share_sections: shareSections,
        contact_id: contactId,
      }),
    );

    const url = `${this.publicWebBase()}/s/${token}`;
    // Dev aid: Device Hub clipboard cannot leave the sandbox — copy URL from this log.
    console.log(
      `[room-share-link] created roomId=${roomId} linkId=${saved.id} expiresAt=${expiresAt.toISOString()} url=${url}`,
    );
    return {
      id: saved.id,
      url,
      expiresAt: expiresAt.toISOString(),
      shareSections,
      contactId,
      status: 'active' as const,
    };
  }

  async list(agentId: number, roomId: number) {
    await this.assertOwnedScoutRoom(agentId, roomId);
    const rows = await this.linksRepo.find({
      where: { rent_room_id: roomId, created_by_user_id: agentId },
      order: { id: 'DESC' },
    });
    const now = new Date();
    return {
      items: rows.map((row) => ({
        id: row.id,
        expiresAt: row.expires_at.toISOString(),
        revokedAt: row.revoked_at?.toISOString() ?? null,
        createdAt: row.created_at.toISOString(),
        shareSections: row.share_sections,
        contactId: row.contact_id,
        status: this.statusOf(row, now),
      })),
    };
  }

  async revoke(agentId: number, roomId: number, linkId: number) {
    await this.assertOwnedScoutRoom(agentId, roomId);
    const link = await this.linksRepo.findOne({
      where: {
        id: linkId,
        rent_room_id: roomId,
        created_by_user_id: agentId,
      },
    });
    if (!link) throw new NotFoundException('Share link not found');
    if (!link.revoked_at) {
      link.revoked_at = new Date();
      await this.linksRepo.save(link);
    }
    return {
      id: link.id,
      status: 'revoked' as const,
      revokedAt: link.revoked_at.toISOString(),
    };
  }

  async publicResolve(token: string) {
    if (!isPlausibleShareLinkToken(token)) {
      throw new NotFoundException('Share link not found');
    }
    const link = await this.linksRepo.findOne({
      where: { token_hash: hashShareLinkToken(token) },
    });
    if (!link) throw new NotFoundException('Share link not found');
    if (link.revoked_at) throw new GoneException('Share link has been disabled');
    if (isShareLinkExpired(link.expires_at)) {
      throw new GoneException('Share link has expired');
    }

    const room = await this.roomsRepo.findOne({
      where: { id: link.rent_room_id, is_scout_room: true },
      relations: {
        property: { property_type: true },
        room_type: true,
        room_status: true,
        medias: true,
        price_rows: { contract_type: true },
        room_contacts: { contact: true },
        layout_values: { layout: true },
        facilities: { facility: { group: true } },
      },
    });
    if (!room) throw new NotFoundException('Share link not found');

    return this.toPublicDto(room, link);
  }

  private toPublicDto(room: RentRoomEntity, link: RoomShareLinkEntity) {
    const sections = normalizeSections(link.share_sections);
    const p = room.property;
    const dto: Record<string, unknown> = {
      id: room.id,
      promoTitle: room.promo_title,
      description: room.listing_description,
      roomStatusCode: room.room_status?.code ?? null,
      roomTypeCode: room.room_type?.code ?? null,
      availableFromDate: room.available_from_date,
      layout: (room.layout_values ?? []).map((v) => ({
        code: v.layout.code,
        value: v.value,
      })),
      expiresAt: link.expires_at.toISOString(),
      shareSections: sections,
    };

    if (sections.photos) {
      dto.medias = [...(room.medias ?? [])]
        .sort(
          (a, b) =>
            Number(b.is_cover) - Number(a.is_cover) ||
            a.sort_order - b.sort_order ||
            a.id - b.id,
        )
        .filter((m) => m.media_type === 'image')
        .map((m) => ({
          id: m.id,
          mediaUrl: m.media_url,
          mediaType: m.media_type,
          isCover: m.is_cover,
        }));
    } else {
      dto.medias = [];
    }

    if (sections.price) {
      dto.prices = [...(room.price_rows ?? [])]
        .sort(
          (a, b) =>
            (a.contract_type?.term_months ?? 0) - (b.contract_type?.term_months ?? 0),
        )
        .map((row) => ({
          contractTypeId: row.contract_type_id,
          contractTypeCode: row.contract_type?.code ?? '',
          termMonths: row.contract_type?.term_months ?? null,
          price: Number(row.price),
          advanceRentMonths: room.advance_rent_months,
          depositMonths: room.deposit_months,
        }));
      dto.advanceRentMonths = room.advance_rent_months;
      dto.depositMonths = room.deposit_months;
    } else {
      dto.prices = [];
      dto.advanceRentMonths = 0;
      dto.depositMonths = 0;
    }

    if (sections.facilities) {
      dto.facilityItems = (room.facilities ?? []).map((f) => ({
        code: f.facility.code,
        groupCode: f.facility.group?.code,
      }));
      dto.facilities = [
        ...(room.facilities ?? []).map((f) => f.facility.code),
        ...(room.custom_facilities ?? []),
      ];
      dto.customFacilities = room.custom_facilities ?? [];
    } else {
      dto.facilityItems = [];
      dto.facilities = [];
      dto.customFacilities = [];
    }

    if (sections.location) {
      dto.nearbyPlaces = room.nearby_places ?? [];
      dto.property = p
        ? {
            id: p.id,
            name: p.name,
            address: p.address,
            subdistrict: p.subdistrict,
            district: p.district,
            province: p.province,
            postalCode: p.postal_code,
            propertyTypeCode: p.property_type?.code ?? null,
            latitude: p.latitude,
            longitude: p.longitude,
          }
        : null;
      dto.latitude = room.latitude ?? p?.latitude ?? null;
      dto.longitude = room.longitude ?? p?.longitude ?? null;
    } else {
      dto.nearbyPlaces = [];
      dto.property = p
        ? {
            id: p.id,
            name: p.name,
            address: null,
            subdistrict: null,
            district: p.district,
            province: p.province,
            postalCode: null,
            propertyTypeCode: p.property_type?.code ?? null,
            latitude: null,
            longitude: null,
          }
        : null;
      dto.latitude = null;
      dto.longitude = null;
    }

    if (sections.contact && link.contact_id) {
      const match = (room.room_contacts ?? []).find(
        (c) => c.contact_id === link.contact_id && c.contact,
      );
      dto.contacts = match?.contact
        ? [
            {
              id: match.contact.id,
              name: match.contact.name,
              phone: match.contact.phone,
              email: match.contact.email,
              lineId: match.contact.line_id,
              facebook: match.contact.facebook,
              isPrimary: match.is_primary,
            },
          ]
        : [];
    } else {
      dto.contacts = [];
    }

    // Never expose internal fields
    dto.listingTitle = null;
    dto.listingSourceCode = null;
    dto.roomId = null;
    dto.visibility = null;
    dto.documents = [];
    dto.nearbyOther = null;

    return dto;
  }
}
