import { PropertyEntity } from '../../entities/property.entity';
import { canonicalProvince, canonicalArea, leadProvinces } from './lead-locations';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository, SelectQueryBuilder } from 'typeorm';
import type { CreateLeadInput, LeadContact, LeadContactChannel, LeadDisplayStatus, LeadPin, LeadPinInput, LeadStatus, AgentLeadsSort } from '@nestyk/types';
import { LeadEntity } from '../../entities/lead.entity';
import { LeadLocationEntity } from '../../entities/lead-location.entity';
import { MasterRoomTypeEntity } from '../../entities/master-room-type.entity';
import { MasterVisaTypeEntity } from '../../entities/master-visa-type.entity';
import { MasterContractTypeEntity } from '../../entities/master-contract-type.entity';
import { loadLastMatches } from './lead-matching.service';
import { loadNextViewings, type NextViewing } from './lead-viewings.service';

const LEAD_MAX_PINS = 3;

function nextViewingFields(next: NextViewing | undefined) {
  return { nextViewingAt: next?.at ?? null, nextViewingRoom: next?.room ?? null };
}
const LEAD_RADII_KM = [1, 3, 5];
const LEAD_CONTACT_CHANNELS: LeadContactChannel[] = ['line', 'whatsapp', 'wechat', 'facebook', 'telegram', 'other'];
const LEAD_MAX_CONTACTS = 5;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const E164_PATTERN = /^\+[1-9]\d{6,14}$/;

/**
 * Digit patterns for phone search: stored numbers are E.164 ("+66812345678") or legacy local
 * ("0812345678"), so a Thai local query also matches the +66 form and vice versa.
 */
export function phoneSearchDigits(q: string): string[] {
  if (!/^[\d\s+().-]+$/.test(q)) return [];
  const digits = q.replace(/\D/g, '');
  if (digits.length < 3) return [];
  const variants = new Set([digits]);
  if (digits.startsWith('0')) variants.add(`66${digits.slice(1)}`);
  if (digits.startsWith('66')) variants.add(`0${digits.slice(2)}`);
  return [...variants];
}

function validateEmail(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || value.trim().length > 255) throw new BadRequestException('email must be text up to 255 characters');
  const email = value.trim();
  if (!email) return null;
  if (!EMAIL_PATTERN.test(email)) throw new BadRequestException('email must be a valid email address');
  return email;
}

function validateContacts(value: unknown): LeadContact[] {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > LEAD_MAX_CONTACTS) throw new BadRequestException(`otherContacts must be a list of up to ${LEAD_MAX_CONTACTS} channels`);
  const seen = new Set<string>();
  const contacts: LeadContact[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new BadRequestException('Invalid contact channel');
    const { channel, value: text } = raw as Record<string, unknown>;
    if (!LEAD_CONTACT_CHANNELS.includes(channel as LeadContactChannel)) throw new BadRequestException(`Contact channel must be one of ${LEAD_CONTACT_CHANNELS.join(', ')}`);
    if (typeof text !== 'string' || !text.trim() || text.trim().length > 255) throw new BadRequestException('Each contact channel requires a value up to 255 characters');
    const key = `${channel}:${text.trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    contacts.push({ channel: channel as LeadContactChannel, value: text.trim() });
  }
  return contacts;
}

function validatePins(value: unknown): LeadPin[] {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > LEAD_MAX_PINS) throw new BadRequestException(`pins must be a list of up to ${LEAD_MAX_PINS} locations`);
  const pins = value.map((raw, index): LeadPin => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new BadRequestException('Invalid pin');
    const pin = raw as Record<string, unknown>;
    const { latitude, longitude } = pin;
    if (typeof latitude !== 'number' || !Number.isFinite(latitude) || Math.abs(latitude) > 90 ||
        typeof longitude !== 'number' || !Number.isFinite(longitude) || Math.abs(longitude) > 180) throw new BadRequestException('Each pin requires valid coordinates');
    if (typeof pin.name !== 'string' || !pin.name.trim() || pin.name.trim().length > 500) throw new BadRequestException('Each pin requires a name up to 500 characters');
    if (pin.placeId != null && (typeof pin.placeId !== 'string' || pin.placeId.trim().length > 255)) throw new BadRequestException('Invalid pin placeId');
    if (pin.district != null && (typeof pin.district !== 'string' || pin.district.length > 255)) throw new BadRequestException('Invalid pin district');
    const province = typeof pin.province === 'string' ? canonicalProvince(pin.province) : null;
    if (!province) throw new BadRequestException('Each pin must be inside a Thai province');
    const district = typeof pin.district === 'string' ? canonicalArea(pin.district) : '';
    return {
      rank: index + 1,
      placeId: typeof pin.placeId === 'string' && pin.placeId.trim() ? pin.placeId.trim() : null,
      name: pin.name.trim(),
      latitude,
      longitude,
      province,
      district: district && district !== '-' ? district : null,
    };
  });
  const seen = new Set<string>();
  for (const pin of pins) {
    const keys = [`${pin.latitude.toFixed(6)},${pin.longitude.toFixed(6)}`, ...(pin.placeId ? [`place:${pin.placeId}`] : [])];
    if (keys.some((k) => seen.has(k))) throw new BadRequestException('Pins must be different locations');
    keys.forEach((k) => seen.add(k));
  }
  return pins;
}

export function validateLead(input: unknown): CreateLeadInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new BadRequestException('Lead data is required');
  const body = input as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  const pins = validatePins(body.pins);
  result.pins = pins;
  if (pins.length) {
    if (!LEAD_RADII_KM.includes(body.radiusKm as number)) throw new BadRequestException('Pinned locations require a radius of 1, 3 or 5 km');
    result.radiusKm = body.radiusKm;
    result.province = pins[0].province;
    result.locations = [...new Set(pins.map((p) => p.district).filter((d): d is string => !!d))];
  } else {
    if (body.radiusKm != null && !LEAD_RADII_KM.includes(body.radiusKm as number)) throw new BadRequestException('radiusKm must be 1, 3 or 5');
    result.radiusKm = null;
    if (body.province != null && (typeof body.province !== 'string' || !canonicalProvince(body.province))) throw new BadRequestException('Invalid province');
    result.province = typeof body.province === 'string' ? canonicalProvince(body.province) : null;
    const locations = body.locations ?? [];
    if (!Array.isArray(locations) || locations.length > 50 || locations.some((v) => typeof v !== 'string' || !v.trim() || v.length > 255)) throw new BadRequestException('Invalid locations');
    result.locations = [...new Set(locations.map(canonicalArea))];
    if ((result.locations as string[]).some((v) => !v || v === '-')) throw new BadRequestException('Invalid locations');
    if (locations.length > 0 && !result.province) throw new BadRequestException('A valid province is required for a location');
  }
  const textFields = { firstName: 255, lastName: 255, phone: 50, nationality: 120, preferredLocation: 500, moveInPlan: 255, occupation: 255, notes: 500 };
  for (const [key, max] of Object.entries(textFields)) {
    const value = body[key];
    const required = key === 'phone';
    if (value == null && !required) { result[key] = null; continue; }
    if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim())) throw new BadRequestException(`${key} ${required ? 'is required and ' : ''}must be text up to ${max} characters`);
    result[key] = value.trim() || null;
  }
  // The app sends E.164; numbers without "+" are legacy free text and stay as typed.
  if (typeof result.phone === 'string' && result.phone.startsWith('+')) {
    const e164 = result.phone.replace(/[\s().-]/g, '');
    if (!E164_PATTERN.test(e164)) throw new BadRequestException('phone must be an international number like +66812345678');
    result.phone = e164;
  }
  result.email = validateEmail(body.email);
  result.otherContacts = validateContacts(body.otherContacts);
  // Older clients send only `name`; split it so given name / surname stay filled.
  if (!result.firstName && typeof body.name === 'string' && body.name.trim()) {
    const parts = body.name.trim().split(/\s+/);
    result.firstName = parts[0];
    if (!result.lastName) result.lastName = parts.slice(1).join(' ') || null;
  }
  if (typeof result.firstName !== 'string' || !result.firstName) throw new BadRequestException('firstName is required and must be text up to 255 characters');
  result.lastName = typeof result.lastName === 'string' ? result.lastName : '';
  result.name = [result.firstName, result.lastName].filter(Boolean).join(' ');
  if ((result.name as string).length > 255) throw new BadRequestException('First and last name together must be up to 255 characters');
  for (const key of ['hasPets', 'usesCar', 'isSmoker']) {
    if (body[key] != null && typeof body[key] !== 'boolean') throw new BadRequestException(`${key} must be true, false or null`);
    result[key] = body[key] ?? null;
  }
  for (const key of ['leaseDurationMonths', 'occupantCount', 'desiredRoomTypeId', 'visaTypeId']) {
    const value = body[key];
    const max = key === 'desiredRoomTypeId' || key === 'visaTypeId' ? 2147483647 : 32767;
    if (value != null && (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > max)) throw new BadRequestException(`${key} must be a positive whole number`);
    result[key] = value ?? null;
  }
  for (const key of ['budgetMin', 'budgetMax']) {
    const value = body[key];
    if (value != null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || (key === 'budgetMax' && value === 0) || value > 9999999999.99 || Math.abs(value * 100 - Math.round(value * 100)) > 0.001)) throw new BadRequestException(`${key} must be a valid monthly budget with up to 2 decimal places`);
    result[key] = value ?? null;
  }
  if (result.budgetMin != null && result.budgetMax != null && Number(result.budgetMin) > Number(result.budgetMax)) throw new BadRequestException('Minimum budget must not exceed maximum budget');
  return result as CreateLeadInput;
}

@Injectable()
export class AgentLeadsService {
  constructor(
    @InjectRepository(LeadEntity) private readonly leads: Repository<LeadEntity>,
    @InjectRepository(MasterRoomTypeEntity) private readonly roomTypes: Repository<MasterRoomTypeEntity>,
    @InjectRepository(MasterVisaTypeEntity) private readonly visaTypes: Repository<MasterVisaTypeEntity>,
    @InjectRepository(MasterContractTypeEntity) private readonly contractTypes: Repository<MasterContractTypeEntity>,
  ) {}

  async listVisaTypes() {
    const rows = await this.visaTypes.find({ where: { is_active: true }, order: { sort_order: 'ASC', id: 'ASC' } });
    return rows.map((row) => ({ id: row.id, code: row.code }));
  }

  async locationCatalog(agentId?: number) {
    const rows = await this.leads.manager.getRepository(PropertyEntity).createQueryBuilder('property')
      .select('property.province', 'province').addSelect('property.district', 'district').distinct(true).getRawMany();
    const areas = new Map<string, Set<string>>();
    for (const row of rows) {
      const province = canonicalProvince(row.province || '');
      const area = canonicalArea(row.district || '');
      if (!province || !area || area === '-') continue;
      if (!areas.has(province)) areas.set(province, new Set());
      areas.get(province)!.add(area);
    }
    if (agentId != null) {
      const saved = await this.leads.createQueryBuilder('lead').select('lead.province', 'province').addSelect('lead.locations', 'locations')
        .where('lead.created_by_user_id = :agentId', { agentId }).distinct(true).getRawMany();
      for (const row of saved) {
        if (!row.province) continue;
        if (!areas.has(row.province)) areas.set(row.province, new Set());
        for (const area of row.locations ?? []) areas.get(row.province)!.add(area);
      }
    }
    return leadProvinces.map((p) => ({ ...p, locations: [...(areas.get(p.name) ?? [])].sort((a, b) => a.localeCompare(b, 'th')) }));
  }

  async create(agentId: number, input: unknown) {
    const b = validateLead(input);
    await this.validateReferences(b);
    const id = await this.leads.manager.transaction(async (em) => {
      const repo = em.getRepository(LeadEntity);
      const row = await repo.save(repo.create({
        ...leadColumns(b), created_by_user_id: agentId,
        rent_room_id: null, status: 'new',
      }));
      await replacePins(em, row.id, b.pins ?? []);
      return row.id;
    });
    return { ...toLead(await this.requireLead(agentId, id)), ...nextViewingFields(undefined) };
  }

  private async validateReferences(b: CreateLeadInput) {
    if (b.locations?.length && !b.pins?.length) {
      const province = (await this.locationCatalog()).find((p) => p.name === b.province);
      if (b.locations.some((area) => !province?.locations.includes(area))) throw new BadRequestException('Location is not available in this province');
    }
    if (b.desiredRoomTypeId != null && !await this.roomTypes.findOne({ where: { id: b.desiredRoomTypeId, is_active: true } })) throw new BadRequestException('Room type is not available');
    if (b.visaTypeId != null && !await this.visaTypes.findOne({ where: { id: b.visaTypeId, is_active: true } })) throw new BadRequestException('Visa type is not available');
    if (b.leaseDurationMonths != null && !await this.contractTypes.findOne({ where: { term_months: b.leaseDurationMonths, is_active: true } })) throw new BadRequestException('Rental duration is not available');
  }

  async update(agentId: number, id: number, input: unknown) {
    const existing = await this.requireLead(agentId, id);
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new BadRequestException('Lead data is required');
    const patch = input as Record<string, unknown>;
    const merged: Record<string, unknown> = { ...toLead(existing), ...patch };
    // A renamed lead sent as `name` only must be re-split, not rebuilt from the stored given name.
    if ('name' in patch && !('firstName' in patch)) {
      delete merged.firstName;
      delete merged.lastName;
    }
    const b = validateLead(merged);
    await this.validateReferences(b);
    await this.leads.manager.transaction(async (em) => {
      await em.getRepository(LeadEntity).update({ id, created_by_user_id: agentId }, leadColumns(b));
      await replacePins(em, id, b.pins ?? []);
    });
    return this.present(await this.requireLead(agentId, id));
  }

  async list(agentId: number, query: { q?: string; page?: string; limit?: string; province?: string; locations?: string; includeUnspecified?: string; sort?: string; status?: string }) {
    if ([query.q, query.province, query.locations, query.page, query.limit, query.includeUnspecified, query.sort, query.status].some((v) => v != null && typeof v !== 'string')) throw new BadRequestException('Invalid query parameters');
    const status = normalizeLeadStatusFilter(query.status);
    const province = query.province ? canonicalProvince(query.province) : null;
    if (query.province && !province) throw new BadRequestException('Invalid province');
    let locations: string[] = [];
    if (query.locations) {
      try { locations = JSON.parse(query.locations); } catch { throw new BadRequestException('Invalid locations'); }
      if (!Array.isArray(locations) || locations.length > 50 || locations.some((v) => typeof v !== 'string' || !v.trim() || v.length > 255)) throw new BadRequestException('Invalid locations');
      if (locations.length && !province) throw new BadRequestException('Province is required for locations');
    }
    const sort = normalizeLeadSort(query.sort);
    const page = Math.max(1, Math.min(1000000, Math.floor(Number(query.page) || 1)));
    const limit = Math.max(1, Math.min(50, Math.floor(Number(query.limit) || 20)));
    const qb = this.leads.createQueryBuilder('lead').leftJoinAndSelect('lead.desired_room_type', 'roomType')
      .leftJoinAndSelect('lead.visa_type', 'visaType')
      .where('lead.created_by_user_id = :agentId', { agentId });
    if (province) qb.andWhere('lead.province = :province', { province });
    if (locations.length) qb.andWhere(query.includeUnspecified === 'true'
      ? '(lead.locations && CAST(:locations AS text[]) OR (cardinality(lead.locations) = 0 AND NOT EXISTS (SELECT 1 FROM lead_locations pin WHERE pin.lead_id = lead.id)))'
      : 'lead.locations && CAST(:locations AS text[])', { locations });
    const q = query.q?.trim();
    if (q) {
      const phoneDigits = phoneSearchDigits(q);
      const phoneSql = phoneDigits.length ? " OR regexp_replace(lead.phone, '\\D', '', 'g') LIKE ANY(CAST(:phoneDigits AS text[]))" : '';
      qb.andWhere(`(lead.name ILIKE :q OR lead.first_name ILIKE :q OR lead.last_name ILIKE :q OR lead.phone ILIKE :q${phoneSql} OR lead.preferred_location ILIKE :q OR lead.province ILIKE :q OR array_to_string(lead.locations, ', ') ILIKE :q OR EXISTS (SELECT 1 FROM lead_locations pin WHERE pin.lead_id = lead.id AND pin.name ILIKE :q))`, {
        q: `%${q.replace(/[\\%_]/g, '\\$&')}%`,
        phoneDigits: phoneDigits.map((d) => `%${d}%`),
      });
    }
    const countsQb = qb.clone();
    if (status) qb.andWhere(`(${DISPLAY_STATUS_SQL}) = :status`, { status });
    applyLeadSort(qb, sort);
    const [[rows, total], statusCounts] = await Promise.all([
      qb.skip((page - 1) * limit).take(limit).getManyAndCount(),
      countByDisplayStatus(countsQb),
    ]);
    if (!rows.length) return { items: [], total, page, limit, statusCounts };
    const pins = await this.leads.manager.getRepository(LeadLocationEntity).find({ where: { lead_id: In(rows.map((r) => r.id)) }, order: { rank: 'ASC' } });
    for (const row of rows) row.pins = pins.filter((p) => p.lead_id === row.id);
    const [lastMatches, nextViewings] = await Promise.all([
      loadLastMatches(this.leads.manager, rows),
      loadNextViewings(this.leads.manager, rows.map((row) => row.id)),
    ]);
    return {
      items: rows.map((row) => ({
        ...toLead(row),
        lastMatch: lastMatches.get(row.id) ?? null,
        ...nextViewingFields(nextViewings.get(row.id)),
      })),
      total,
      page,
      limit,
      statusCounts,
    };
  }

  async view(agentId: number, id: number) {
    return this.present(await this.requireLead(agentId, id));
  }

  async markInProgress(agentId: number, id: number) {
    const row = await this.requireLead(agentId, id);
    if (row.status === 'booked') throw new ConflictException('Booked leads cannot move to in progress');
    if (row.status === 'inprogress') return this.present(row);
    row.status = 'inprogress';
    row.lost_reason = null;
    await this.leads.save(row);
    return this.present(row);
  }

  async markLost(agentId: number, id: number, input: unknown) {
    const row = await this.requireLead(agentId, id);
    if (row.status === 'booked') throw new ConflictException('Booked leads cannot be marked lost');
    const reason = parseLostReason(input);
    row.status = 'lost';
    row.lost_reason = reason;
    await this.leads.save(row);
    return this.present(row);
  }

  private async present(row: LeadEntity) {
    const nextViewings = await loadNextViewings(this.leads.manager, [row.id]);
    return { ...toLead(row), ...nextViewingFields(nextViewings.get(row.id)) };
  }

  private async requireLead(agentId: number, id: number) {
    const row = await this.leads.findOne({ where: { id, created_by_user_id: agentId }, relations: { desired_room_type: true, visa_type: true, pins: true } });
    if (!row) throw new NotFoundException('Lead not found');
    return row;
  }
}

function leadColumns(b: CreateLeadInput) {
  return {
    radius_km: b.radiusKm ?? null, province: b.province ?? null, locations: b.locations ?? [],
    name: b.name, first_name: b.firstName ?? '', last_name: b.lastName ?? '',
    phone: b.phone, email: b.email ?? null, other_contacts: b.otherContacts ?? [],
    nationality: b.nationality ?? null,
    budget_min: b.budgetMin == null ? null : String(b.budgetMin), budget_max: b.budgetMax == null ? null : String(b.budgetMax),
    preferred_location: b.preferredLocation ?? null, move_in_plan: b.moveInPlan ?? null, has_pets: b.hasPets ?? null,
    occupation: b.occupation ?? null, visa_type_id: b.visaTypeId ?? null, lease_duration_months: b.leaseDurationMonths ?? null,
    uses_car: b.usesCar ?? null, occupant_count: b.occupantCount ?? null, is_smoker: b.isSmoker ?? null,
    desired_room_type_id: b.desiredRoomTypeId ?? null, notes: b.notes ?? null,
  };
}

async function replacePins(em: EntityManager, leadId: number, pins: LeadPinInput[]) {
  const repo = em.getRepository(LeadLocationEntity);
  await repo.delete({ lead_id: leadId });
  if (!pins.length) return;
  await repo.insert(pins.map((pin, index) => ({
    lead_id: leadId, rank: index + 1, place_id: pin.placeId ?? null, name: pin.name,
    latitude: pin.latitude, longitude: pin.longitude, province: pin.province, district: pin.district ?? null,
  })));
}

function parseLostReason(input: unknown): string {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new BadRequestException('Lost reason is required');
  const value = (input as Record<string, unknown>).lostReason;
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 500) {
    throw new BadRequestException('lostReason must be text up to 500 characters');
  }
  return value.trim();
}

const LEAD_SORTS: AgentLeadsSort[] = [
  'created_desc',
  'created_asc',
  'updated_desc',
  'name_asc',
  'budget_asc',
  'budget_desc',
  'status_asc',
  'status_desc',
];

const STATUS_RANK_SQL =
  "CASE lead.status WHEN 'new' THEN 1 WHEN 'inprogress' THEN 2 WHEN 'booked' THEN 3 WHEN 'lost' THEN 4 ELSE 5 END";

const BUDGET_SORT_SQL = 'COALESCE(lead.budget_min, lead.budget_max)';

const DISPLAY_STATUSES: LeadDisplayStatus[] = ['new', 'inprogress', 'viewing', 'booked', 'lost'];

/** Same rule as `loadNextViewings` and the app's `leadDisplayStatus`. */
const UPCOMING_VIEWING_SQL =
  "EXISTS (SELECT 1 FROM lead_viewings viewing WHERE viewing.lead_id = lead.id AND viewing.status = 'scheduled' AND viewing.scheduled_at > now())";
const DISPLAY_STATUS_SQL = `CASE WHEN lead.status IN ('new', 'inprogress') AND ${UPCOMING_VIEWING_SQL} THEN 'viewing' ELSE lead.status END`;

export function normalizeLeadStatusFilter(value?: string): LeadDisplayStatus | null {
  if (value == null || value === '') return null;
  if ((DISPLAY_STATUSES as string[]).includes(value)) return value as LeadDisplayStatus;
  throw new BadRequestException('Invalid status');
}

async function countByDisplayStatus(qb: SelectQueryBuilder<LeadEntity>): Promise<Record<LeadDisplayStatus, number>> {
  const counts = Object.fromEntries(DISPLAY_STATUSES.map((s) => [s, 0])) as Record<LeadDisplayStatus, number>;
  const rows: Array<{ status: string; count: string | number }> = await qb
    .select(DISPLAY_STATUS_SQL, 'status')
    .addSelect('COUNT(*)', 'count')
    .groupBy(DISPLAY_STATUS_SQL)
    .getRawMany();
  for (const row of rows) {
    if ((DISPLAY_STATUSES as string[]).includes(row.status)) counts[row.status as LeadDisplayStatus] = Number(row.count);
  }
  return counts;
}

export function normalizeLeadSort(value?: string): AgentLeadsSort {
  if (value == null || value === '') return 'updated_desc';
  if ((LEAD_SORTS as string[]).includes(value)) return value as AgentLeadsSort;
  throw new BadRequestException('Invalid sort');
}

function applyLeadSort(qb: SelectQueryBuilder<LeadEntity>, sort: AgentLeadsSort) {
  if (sort === 'created_asc') {
    qb.orderBy('lead.created_at', 'ASC').addOrderBy('lead.id', 'ASC');
    return;
  }
  if (sort === 'updated_desc') {
    qb.orderBy('lead.updated_at', 'DESC').addOrderBy('lead.id', 'DESC');
    return;
  }
  if (sort === 'name_asc') {
    qb.orderBy('lead.name', 'ASC').addOrderBy('lead.id', 'ASC');
    return;
  }
  if (sort === 'budget_asc' || sort === 'budget_desc') {
    // TypeORM orderBy cannot take raw COALESCE(...) — select an alias first.
    qb.addSelect(BUDGET_SORT_SQL, 'sort_budget');
    qb.orderBy('sort_budget', sort === 'budget_asc' ? 'ASC' : 'DESC', 'NULLS LAST')
      .addOrderBy('lead.id', sort === 'budget_asc' ? 'ASC' : 'DESC');
    return;
  }
  if (sort === 'status_asc' || sort === 'status_desc') {
    // TypeORM orderBy cannot take raw CASE ... — select an alias first.
    qb.addSelect(STATUS_RANK_SQL, 'sort_status_rank');
    qb.orderBy('sort_status_rank', sort === 'status_asc' ? 'ASC' : 'DESC')
      .addOrderBy('lead.created_at', 'DESC')
      .addOrderBy('lead.id', 'DESC');
    return;
  }
  qb.orderBy('lead.created_at', 'DESC').addOrderBy('lead.id', 'DESC');
}

function toLead(row: LeadEntity) {
  const pins: LeadPin[] = [...(row.pins ?? [])].sort((a, b) => a.rank - b.rank).map((pin) => ({
    rank: pin.rank, placeId: pin.place_id ?? null, name: pin.name,
    latitude: Number(pin.latitude), longitude: Number(pin.longitude), province: pin.province, district: pin.district ?? null,
  }));
  return {
    pins, radiusKm: row.radius_km ?? null,
    province: row.province ?? null, locations: row.locations ?? [],
    id: row.id, name: row.name, firstName: row.first_name ?? '', lastName: row.last_name ?? '',
    phone: row.phone, email: row.email ?? null,
    otherContacts: (row.other_contacts ?? []) as LeadContact[], nationality: row.nationality,
    budgetMin: row.budget_min == null ? null : Number(row.budget_min), budgetMax: row.budget_max == null ? null : Number(row.budget_max),
    preferredLocation: row.preferred_location, moveInPlan: row.move_in_plan, hasPets: row.has_pets,
    occupation: row.occupation, visaTypeId: row.visa_type_id, visaTypeCode: row.visa_type?.code ?? null,
    leaseDurationMonths: row.lease_duration_months,
    usesCar: row.uses_car, occupantCount: row.occupant_count, isSmoker: row.is_smoker,
    desiredRoomTypeId: row.desired_room_type_id, desiredRoomTypeCode: row.desired_room_type?.code ?? null,
    notes: row.notes ?? null,
    status: row.status as LeadStatus, lostReason: row.lost_reason ?? null, createdAt: row.created_at,
    // Set by booking (POST /agent/tenants): the tenant made from this lead and the room it took.
    tenantId: row.tenant_id ?? null, rentRoomId: row.rent_room_id ?? null,
  };
}
