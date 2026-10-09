import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DataSource, In, Not, QueryFailedError } from "typeorm";
import type {
  AgentTenant,
  CreateAgentTenant,
  UpdateAgentTenant,
} from "@nestyk/types";
import { TenantEntity } from "../../entities/tenant.entity";
import { LeadEntity } from "../../entities/lead.entity";
import { RentRoomEntity } from "../../entities/rent-room.entity";
import { LeadViewingEntity } from "../../entities/lead-viewing.entity";
import { AgentContractsService } from "../contracts/agent-contracts.service";

const ROOM_ALREADY_BOOKED = "ห้องนี้มีผู้จองแล้ว";

/** Postgres unique violation on `uq_leads_one_booked_per_room`: two bookings of one room raced. */
function isRoomAlreadyBookedError(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) return false;
  const driver = error.driverError as
    | { code?: string; constraint?: string }
    | undefined;
  return (
    driver?.code === "23505" &&
    driver?.constraint === "uq_leads_one_booked_per_room"
  );
}

function parseTenantProfile(input: unknown): UpdateAgentTenant {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new BadRequestException("กรุณาระบุข้อมูลผู้เช่า");
  const b = input as Record<string, unknown>;
  for (const [key, max] of [
    ["firstName", 255],
    ["lastName", 255],
    ["phone", 50],
    ["email", 255],
    ["note", 500],
    ["identityNumber", 100],
    ["nationality", 120],
  ] as const) {
    const v = b[key];
    const required = key === "phone";
    if (v == null && !required) continue;
    if (
      typeof v !== "string" ||
      v.trim().length > max ||
      (required && !v.trim())
    )
      throw new BadRequestException(
        "กรุณาระบุชื่อและเบอร์โทรให้ครบ และตรวจสอบความยาวข้อมูล",
      );
  }
  const email = typeof b.email === "string" ? b.email.trim() : "";
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new BadRequestException("รูปแบบอีเมลไม่ถูกต้อง");
  const phone = String(b.phone).trim();
  if (
    !/^[+\d\s().-]+$/.test(phone) ||
    phone.replace(/\D/g, "").length < 7 ||
    phone.replace(/\D/g, "").length > 15
  )
    throw new BadRequestException("กรุณาระบุเบอร์โทรที่ถูกต้อง");
  const identityNumber =
    typeof b.identityNumber === "string" ? b.identityNumber.trim() : "";
  if (
    identityNumber &&
    !/^[A-Za-z0-9][A-Za-z0-9\s/-]{4,99}$/.test(identityNumber)
  )
    throw new BadRequestException(
      "กรุณาระบุเลขบัตรประชาชนหรือพาสปอร์ตให้ถูกต้อง",
    );
  let firstName = typeof b.firstName === "string" ? b.firstName.trim() : "";
  let lastName = typeof b.lastName === "string" ? b.lastName.trim() : "";
  if (!firstName && typeof b.name === "string" && b.name.trim()) {
    const parts = b.name.trim().split(/\s+/);
    firstName = parts[0] ?? "";
    lastName = lastName || parts.slice(1).join(" ");
  }
  if (!firstName || firstName.length > 255 || lastName.length > 255)
    throw new BadRequestException(
      "กรุณาระบุชื่อและเบอร์โทรให้ครบ และตรวจสอบความยาวข้อมูล",
    );
  return {
    name: [firstName, lastName].filter(Boolean).join(" "),
    firstName,
    lastName,
    phone,
    email,
    note: typeof b.note === "string" ? b.note.trim() : "",
    identityNumber,
    nationality:
      typeof b.nationality === "string" ? b.nationality.trim() : "",
  };
}

export function validateTenantProfile(input: unknown): UpdateAgentTenant {
  return parseTenantProfile(input);
}

export function validateTenant(input: unknown): CreateAgentTenant {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new BadRequestException("กรุณาระบุข้อมูลผู้เช่า");
  const b = input as Record<string, unknown>;
  for (const key of ["leadId", "rentRoomId"])
    if (
      !Number.isSafeInteger(b[key]) ||
      Number(b[key]) < 1 ||
      Number(b[key]) > 2147483647
    )
      throw new BadRequestException("กรุณาเลือก Lead และห้องที่เช่า");
  return {
    leadId: Number(b.leadId),
    rentRoomId: Number(b.rentRoomId),
    ...parseTenantProfile(input),
  };
}

@Injectable()
export class AgentTenantsService {
  constructor(
    private readonly db: DataSource,
    private readonly contracts: AgentContractsService,
  ) {}
  private query(agentId: number) {
    return this.db
      .getRepository(TenantEntity)
      .createQueryBuilder("tenant")
      .leftJoinAndSelect("tenant.lead", "lead")
      .leftJoinAndSelect("lead.rent_room", "room")
      .leftJoinAndSelect("room.property", "property")
      .where("tenant.created_by_user_id = :agentId", { agentId });
  }
  private serialize(
    t: TenantEntity,
    contracts: AgentTenant["contracts"],
  ): AgentTenant {
    const property = t.lead?.rent_room?.property;
    const fullAddress = property
      ? [
          property.address,
          property.subdistrict,
          property.district,
          property.province,
          property.postal_code,
        ]
          .map((part) => (typeof part === "string" ? part.trim() : ""))
          .filter((part) => part && part !== "-")
          .join(", ") || null
      : null;
    return {
      id: t.id,
      leadId: t.lead_id,
      name: t.name,
      firstName: t.first_name ?? "",
      lastName: t.last_name ?? "",
      phone: t.phone,
      email: t.email,
      note: t.note,
      identityNumber: t.identity_number ?? null,
      nationality: t.nationality ?? null,
      createdAt: t.created_at.toISOString(),
      property:
        property?.name ||
        t.lead?.rent_room?.listing_title ||
        "ยังไม่ระบุห้อง",
      room: t.lead?.rent_room?.room_id || null,
      fullAddress,
      contracts: contracts.filter((c) => c.tenantId === t.id),
    };
  }
  async list(agentId: number) {
    const [tenants, contracts] = await Promise.all([
      this.query(agentId).orderBy("tenant.id", "DESC").getMany(),
      this.contracts.list(agentId),
    ]);
    return tenants.map((t) => this.serialize(t, contracts));
  }
  async view(agentId: number, id: number) {
    const tenant = await this.query(agentId)
      .andWhere("tenant.id = :id", { id })
      .getOne();
    if (!tenant) throw new NotFoundException("ไม่พบผู้เช่า");
    return this.serialize(tenant, await this.contracts.list(agentId));
  }
  async leadOptions(agentId: number, q = "") {
    const leads = await this.db
      .getRepository(LeadEntity)
      .createQueryBuilder("lead")
      .where("lead.created_by_user_id = :agentId", { agentId })
      .andWhere("lead.tenant_id IS NULL")
      .andWhere("lead.status != :lost", { lost: "lost" })
      .andWhere("(lead.name ILIKE :q OR lead.first_name ILIKE :q OR lead.last_name ILIKE :q OR lead.phone ILIKE :q)", {
        q: `%${String(q).slice(0, 255)}%`,
      })
      .orderBy("lead.id", "DESC")
      .take(30)
      .getMany();
    return leads.map((l) => ({
      id: l.id,
      name: l.name,
      firstName: l.first_name ?? "",
      lastName: l.last_name ?? "",
      phone: l.phone,
      email: l.email,
      nationality: l.nationality,
    }));
  }
  async roomOptions(
    agentId: number,
    q = "",
    options: { leadId?: number; roomId?: number } = {},
  ) {
    const search = String(q).slice(0, 255);
    const latest = await this.db
      .getRepository(RentRoomEntity)
      .createQueryBuilder("room")
      .leftJoinAndSelect("room.property", "property")
      .where("room.created_by_user_id = :agentId", { agentId })
      .andWhere(
        "(property.name ILIKE :q OR room.room_id ILIKE :q OR room.listing_title ILIKE :q)",
        { q: `%${search}%` },
      )
      .orderBy("room.id", "DESC")
      .take(30)
      .getMany();
    // Rooms the lead has a viewing for, and the room being booked, lead the list even when they
    // are not among the latest 30.
    const viewedIds = options.leadId
      ? await this.viewedRoomIds(agentId, options.leadId)
      : [];
    const pinnedIds = [
      ...new Set([...(options.roomId ? [options.roomId] : []), ...viewedIds]),
    ];
    const pinned = await this.roomsById(agentId, pinnedIds, search);
    const pinnedSet = new Set(pinned.map((r) => r.id));
    const rooms = [
      ...pinned,
      ...latest.filter((r) => !pinnedSet.has(r.id)),
    ].slice(0, 30);
    const bookedBy = await this.bookedLeadNames(
      agentId,
      rooms.map((r) => r.id),
    );
    const viewed = new Set(viewedIds);
    return rooms.map((r) => ({
      id: r.id,
      property: r.property?.name || r.listing_title || "ไม่ระบุโครงการ",
      room: r.room_id,
      viewed: viewed.has(r.id),
      bookedBy: bookedBy.get(r.id) ?? null,
    }));
  }
  /** Rooms this lead has a viewing of that was not cancelled. */
  private async viewedRoomIds(agentId: number, leadId: number) {
    const viewings = await this.db.getRepository(LeadViewingEntity).find({
      where: {
        lead_id: leadId,
        created_by_user_id: agentId,
        status: Not("cancelled"),
      },
      select: { id: true, rent_room_id: true },
    });
    return [...new Set(viewings.map((v) => v.rent_room_id))];
  }
  private async roomsById(agentId: number, ids: number[], search: string) {
    if (!ids.length) return [];
    const rooms = await this.db.getRepository(RentRoomEntity).find({
      where: { id: In(ids), created_by_user_id: agentId },
      relations: { property: true },
      order: { id: "DESC" },
    });
    const needle = search.trim().toLowerCase();
    if (!needle) return rooms;
    return rooms.filter((r) =>
      [r.property?.name, r.room_id, r.listing_title].some((value) =>
        (value ?? "").toLowerCase().includes(needle),
      ),
    );
  }
  /** Room id → name of the agent's lead that booked it. */
  private async bookedLeadNames(agentId: number, roomIds: number[]) {
    const names = new Map<number, string>();
    if (!roomIds.length) return names;
    const leads = await this.db.getRepository(LeadEntity).find({
      where: {
        rent_room_id: In(roomIds),
        status: "booked",
        created_by_user_id: agentId,
      },
      select: { id: true, name: true, rent_room_id: true },
    });
    for (const lead of leads)
      if (lead.rent_room_id != null) names.set(lead.rent_room_id, lead.name);
    return names;
  }
  async create(agentId: number, input: unknown) {
    const b = validateTenant(input);
    const id = await this.promote(agentId, b).catch((error: unknown) => {
      if (isRoomAlreadyBookedError(error))
        throw new ConflictException({
          code: "ROOM_ALREADY_BOOKED",
          message: ROOM_ALREADY_BOOKED,
        });
      throw error;
    });
    return this.view(agentId, id);
  }
  /** The tenant row and the lead's move to `booked`, in one transaction. */
  private promote(agentId: number, b: CreateAgentTenant): Promise<number> {
    return this.db.transaction(async (manager) => {
      const lead = await manager.findOne(LeadEntity, {
        where: { id: b.leadId, created_by_user_id: agentId },
        lock: { mode: "pessimistic_write" },
      });
      if (!lead) throw new NotFoundException("ไม่พบ Lead ที่คุณมีสิทธิ์จัดการ");
      if (
        lead.tenant_id ||
        (await manager.findOneBy(TenantEntity, { lead_id: lead.id }))
      )
        throw new ConflictException("Lead นี้ถูกสร้างเป็นผู้เช่าแล้ว");
      if (lead.status === "lost")
        throw new ConflictException(
          "Lead ที่ปิดเป็นไม่สำเร็จยังไม่สามารถสร้างผู้เช่าได้",
        );
      // Locked, so two bookings of one room queue up here and the second sees the first below.
      const room = await manager.findOne(RentRoomEntity, {
        where: { id: b.rentRoomId, created_by_user_id: agentId },
        lock: { mode: "pessimistic_write" },
      });
      if (!room) throw new NotFoundException("ไม่พบห้องที่คุณมีสิทธิ์จัดการ");
      // One booked lead per room: say so here, before the unique index does.
      const taken = await manager.findOne(LeadEntity, {
        where: { rent_room_id: room.id, status: "booked" },
      });
      if (taken && taken.id !== lead.id)
        throw new ConflictException({
          code: "ROOM_ALREADY_BOOKED",
          message:
            taken.created_by_user_id === agentId
              ? `${ROOM_ALREADY_BOOKED} (${taken.name})`
              : ROOM_ALREADY_BOOKED,
        });
      const tenant = await manager.save(
        TenantEntity,
        manager.create(TenantEntity, {
          lead_id: lead.id,
          created_by_user_id: agentId,
          name: b.name,
          first_name: b.firstName,
          last_name: b.lastName,
          phone: b.phone,
          email: b.email || null,
          note: b.note || null,
          identity_number: b.identityNumber || null,
          nationality: b.nationality || lead.nationality || null,
        }),
      );
      lead.tenant_id = tenant.id;
      lead.rent_room_id = room.id;
      lead.status = "booked";
      await manager.save(LeadEntity, lead);
      return tenant.id;
    });
  }
  async update(agentId: number, id: number, input: unknown) {
    const b = validateTenantProfile(input);
    const tenant = await this.query(agentId)
      .andWhere("tenant.id = :id", { id })
      .getOne();
    if (!tenant) throw new NotFoundException("ไม่พบผู้เช่า");
    tenant.name = b.name;
    tenant.first_name = b.firstName;
    tenant.last_name = b.lastName;
    tenant.phone = b.phone;
    tenant.email = b.email || null;
    tenant.note = b.note || null;
    tenant.identity_number = b.identityNumber || null;
    tenant.nationality = b.nationality || null;
    await this.db.getRepository(TenantEntity).save(tenant);
    return this.view(agentId, id);
  }
}
