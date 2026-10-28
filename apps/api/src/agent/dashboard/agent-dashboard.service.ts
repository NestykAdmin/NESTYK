import { Injectable, Logger } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import type { AgentDashboardData, AgentDashboardDeepLink, AgentWorkItemKind } from '@nestyk/types';
import { RentRoomEntity } from '../../entities/rent-room.entity';
import { LeadEntity } from '../../entities/lead.entity';
import { LeadViewingEntity } from '../../entities/lead-viewing.entity';
import { TenantEntity } from '../../entities/tenant.entity';
import { LeaseContractEntity } from '../../entities/lease-contract.entity';
import { DealOfferEntity } from '../../entities/deal-offer.entity';
import { TenantBillEntity } from '../../entities/tenant-bill.entity';
import { roomDealStatuses } from '../rooms/room-deal-status';

const DAY_MS = 86_400_000;
const SETTLED = new Set(['active', 'cancelled', 'expired', 'terminated']);
const formKind = (contract: LeaseContractEntity) =>
  contract.template?.form_kind ?? contract.agreement_type?.form_kind ?? 'lease';
const isStay = (contract: LeaseContractEntity) => ['lease', 'renewal'].includes(formKind(contract));
const dateKey = (at: Date) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(at);
const iso = (value: Date) => new Date(value).toISOString();
const dayNumber = (key: string) => Date.parse(`${key.slice(0, 10)}T00:00:00Z`) / DAY_MS;

/** Sum database numeric values as integer cents; do not accumulate binary currency fractions. */
function moneyTotal(rows: TenantBillEntity[]): number {
  const cents = rows.reduce((sum, row) => {
    const [whole, fraction = ''] = row.amount.split('.');
    return sum + BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  }, 0n);
  return Number(cents) / 100;
}

/** Same stay precedence as consumer tenantLease: covering active, any active, then newest stay. */
function tenantLease(contracts: LeaseContractEntity[], today: string) {
  const stays = contracts.filter(c => isStay(c) && c.status !== 'cancelled')
    .sort((a, b) => b.start_date.localeCompare(a.start_date) || b.id - a.id);
  return stays.find(c => c.status === 'active' && c.start_date <= today && (!c.end_date || c.end_date >= today))
    ?? stays.find(c => c.status === 'active') ?? stays[0] ?? null;
}

@Injectable()
export class AgentDashboardService {
  private readonly logger = new Logger(AgentDashboardService.name);
  constructor(private readonly db: DataSource) {}

  /** D8: rooms with their status from the deals (the stored code if that lookup fails). */
  private async rooms(agentId: number, today: string) {
    const rooms = await this.roomRows(agentId);
    const statuses = await roomDealStatuses(this.db, agentId, rooms.map((room) => room.id), today).catch((error: unknown) => {
      this.logger.warn(`Room statuses failed: ${error instanceof Error ? error.message : String(error)}`);
      return new Map<number, { status: string }>();
    });
    return rooms.map((room) => Object.assign(room, { dealStatus: statuses.get(room.id)?.status ?? room.room_status?.code ?? null }));
  }

  private roomRows(agentId: number) {
    return this.db.getRepository(RentRoomEntity).createQueryBuilder('room')
      .leftJoin('room.room_status', 'roomStatus')
      .leftJoin('room.property', 'property')
      .leftJoin('room.layout_values', 'layoutValue')
      .leftJoin('layoutValue.layout', 'layout')
      .leftJoin('room.price_rows', 'price')
      .select(['room.id', 'room.listing_title', 'room.room_id', 'room.visibility', 'room.created_at',
        'roomStatus.id', 'roomStatus.code', 'property.id', 'property.name', 'property.district',
        'layoutValue.id', 'layoutValue.value', 'layout.id', 'layout.code', 'price.id', 'price.price'])
      .where('room.created_by_user_id = :agentId', { agentId })
      .andWhere('room.is_scout_room = true').getMany();
  }

  private leads(agentId: number) {
    return this.db.getRepository(LeadEntity).createQueryBuilder('lead')
      .select(['lead.id', 'lead.name', 'lead.status', 'lead.created_at'])
      .where('lead.created_by_user_id = :agentId', { agentId }).getMany();
  }

  private viewings(agentId: number) {
    return this.db.getRepository(LeadViewingEntity).createQueryBuilder('viewing')
      .leftJoin('viewing.lead', 'lead').leftJoin('viewing.rent_room', 'room')
      .leftJoin('room.property', 'property')
      .select(['viewing.id', 'viewing.lead_id', 'viewing.scheduled_at', 'viewing.status',
        'lead.id', 'lead.name', 'room.id', 'room.listing_title', 'property.id', 'property.name'])
      .where('viewing.created_by_user_id = :agentId', { agentId }).getMany();
  }

  private tenants(agentId: number) {
    return this.db.getRepository(TenantEntity).createQueryBuilder('tenant')
      .select(['tenant.id', 'tenant.name'])
      .where('tenant.created_by_user_id = :agentId', { agentId }).getMany();
  }

  private contracts(agentId: number) {
    return this.db.getRepository(LeaseContractEntity).createQueryBuilder('c')
      .leftJoin('c.template', 'template').leftJoin('c.agreement_type', 'agreementType')
      .leftJoin('c.rent_room', 'room').leftJoin('room.property', 'property')
      .select(['c.id', 'c.tenant_id', 'c.lead_id', 'c.rent_room_id', 'c.status', 'c.start_date', 'c.end_date', 'c.previous_agreement_id',
        'c.owner_delivered_at', 'c.tenant_delivered_at', 'template.id', 'template.form_kind',
        'agreementType.id', 'agreementType.form_kind', 'room.id', 'room.listing_title', 'property.id', 'property.name'])
      .where('c.created_by_user_id = :agentId', { agentId }).getMany();
  }

  /** Match tenant billing's contract-or-tenant ownership and lease/renewal form scope, without issuing bills. */
  private bills(agentId: number) {
    return this.db.getRepository(TenantBillEntity).createQueryBuilder('b')
      .innerJoin('b.lease_contract', 'c').innerJoin('b.tenant', 'tenant')
      .leftJoin('c.template', 'template').leftJoin('c.agreement_type', 'agreementType')
      .select(['b.id', 'b.period', 'b.amount', 'b.status', 'b.grace_until', 'b.paid_at', 'tenant.id', 'tenant.name'])
      .where('(c.created_by_user_id = :agentId OR tenant.created_by_user_id = :agentId)', { agentId })
      .andWhere("COALESCE(template.form_kind, agreementType.form_kind) IN ('lease', 'renewal')").getMany();
  }

  async getDashboard(agentId: number, now = new Date()): Promise<AgentDashboardData> {
    const today = dateKey(now);
    const [year, month] = today.split('-').map(Number);
    const dayStart = Date.parse(`${today}T00:00:00+07:00`);
    const period = today.slice(0, 7);
    // Sources fail independently. A failed query must never masquerade as an available empty section.
    const [roomResult, leadResult, viewingResult, tenantResult, contractResult, billResult] = await Promise.allSettled([
      this.rooms(agentId, today), this.leads(agentId), this.viewings(agentId), this.tenants(agentId), this.contracts(agentId), this.bills(agentId),
    ]);
    const rooms = roomResult.status === 'fulfilled' ? roomResult.value : [];
    const leads = leadResult.status === 'fulfilled' ? leadResult.value : [];
    const viewings = viewingResult.status === 'fulfilled' ? viewingResult.value : [];
    const tenants = tenantResult.status === 'fulfilled' ? tenantResult.value : [];
    const contracts = contractResult.status === 'fulfilled' ? contractResult.value : [];
    const bills = billResult.status === 'fulfilled' ? billResult.value : [];
    const sectionStatus = (...results: PromiseSettledResult<unknown>[]): 'available' | 'error' =>
      results.every(result => result.status === 'fulfilled') ? 'available' : 'error';
    const inventoryStatus = sectionStatus(roomResult);
    const clientsStatus = sectionStatus(tenantResult, contractResult);
    const openLeads = leads.filter(lead => lead.status === 'new' || lead.status === 'inprogress');
    const futureViewingLeads = new Set(viewings.filter(viewing => viewing.status === 'scheduled' && new Date(viewing.scheduled_at).getTime() > now.getTime()).map(viewing => viewing.lead_id));
    const followUps = openLeads.filter(lead => !futureViewingLeads.has(lead.id));
    const available = rooms.filter(room => room.dealStatus === 'available').length;
    let draft = 0;
    let signing = 0;
    let active = 0;
    const renewals: NonNullable<AgentDashboardData['clients']['renewal']>[] = [];
    const leadIds = [...new Set(contracts.map((c) => c.lead_id).filter((id) => id != null))];
    const notice = new Map<string, number>();
    if (leadIds.length) {
      const offers = await this.db.getRepository(DealOfferEntity).find({
        where: { lead_id: In(leadIds), status: 'confirmed' },
      }).catch(() => [] as DealOfferEntity[]);
      for (const offer of offers) notice.set(`${offer.lead_id}:${offer.rent_room_id}`, offer.renewal_notice_days);
    }
    for (const tenant of tenants) {
      const documents = contracts.filter(contract => contract.tenant_id === tenant.id);
      const lease = tenantLease(documents, today);
      if (lease?.status === 'active') {
        active++;
        if (lease.end_date) {
          const daysLeft = dayNumber(lease.end_date) - dayNumber(today);
          const successor = documents.some(c => c.previous_agreement_id === lease.id && c.status !== 'cancelled');
          const window = notice.get(`${lease.lead_id}:${lease.rent_room_id}`) ?? 30;
          if (daysLeft >= 0 && daysLeft <= window && !successor) renewals.push({
            id: String(lease.id), title: lease.rent_room?.property?.name || lease.rent_room?.listing_title || tenant.name,
            endsAt: lease.end_date, daysLeft,
          });
        }
      } else {
        const pending = documents.filter(c => !SETTLED.has(c.status));
        if ((lease?.status === 'expired' || lease?.status === 'terminated') && !pending.length) continue;
        if (pending.some(c => c.status !== 'draft')) signing++;
        else draft++;
      }
    }
    renewals.sort((a, b) => a.daysLeft - b.daysLeft || a.id.localeCompare(b.id));
    const overdue = bills.filter(b => b.status !== 'paid' && today > b.grace_until);
    const monthBills = bills.filter(b => b.period === period);
    const actionItems: AgentDashboardData['actionRequired']['items'] = [];
    const addWork = (kind: AgentWorkItemKind, count: number, amount?: number) => {
      if (!count) return;
      actionItems.push({ id: kind, kind, count, ...(amount == null ? {} : { amount }),
        deepLink: { type: 'tab', tab: kind === 'lead_follow_up' ? 'listingLead' : 'clients', filter: { kind: 'work', work: kind } },
      });
    };
    if (billResult.status === 'fulfilled') addWork('overdue_payment', overdue.length, moneyTotal(overdue));
    if (leadResult.status === 'fulfilled' && viewingResult.status === 'fulfilled') addWork('lead_follow_up', followUps.length);
    if (contractResult.status === 'fulfilled') addWork('awaiting_signature', contracts.filter(c => c.status === 'awaiting_signatures' || c.status === 'awaiting_agent_review').length);
    if (clientsStatus === 'available') addWork('renewal', renewals.length);
    const activity: AgentDashboardData['activity']['items'] = [];
    const event = (id: string, kind: AgentDashboardData['activity']['items'][number]['kind'], subject: string, at: Date | null, deepLink: AgentDashboardDeepLink) => {
      if (at) activity.push({ id, kind, subject, at: iso(at), deepLink });
    };
    for (const lead of leads) event(`lead-${lead.id}`, 'lead_added', lead.name, lead.created_at, { type: 'tab', tab: 'listingLead' });
    for (const contract of contracts) {
      const subject = contract.rent_room?.property?.name || contract.rent_room?.listing_title || '';
      event(`contract-${contract.id}-owner`, 'contract_sent', subject, contract.owner_delivered_at, { type: 'tab', tab: 'clients' });
      event(`contract-${contract.id}-tenant`, 'contract_sent', subject, contract.tenant_delivered_at, { type: 'tab', tab: 'clients' });
    }
    for (const bill of bills) if (bill.status === 'paid') event(`bill-${bill.id}`, 'payment_recorded', bill.tenant?.name || '', bill.paid_at, { type: 'tab', tab: 'clients' });
    activity.sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id));
    return {
      generatedAt: now.toISOString(),
      business: { status: sectionStatus(roomResult, leadResult, tenantResult, contractResult), availableListings: available,
        totalListings: rooms.length, openLeads: openLeads.length, currentClients: draft + signing + active,
        tenantsCount: active, commissionPending: 0, currency: 'THB' },
      actionRequired: { status: sectionStatus(leadResult, viewingResult, tenantResult, contractResult, billResult), items: actionItems },
      schedule: { status: sectionStatus(viewingResult), items: viewings
        .filter(v => v.status === 'scheduled' && new Date(v.scheduled_at).getTime() >= dayStart && new Date(v.scheduled_at).getTime() < dayStart + DAY_MS)
        .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime() || a.id - b.id)
        .map(v => ({ id: String(v.id), startsAt: iso(v.scheduled_at), title: v.rent_room?.listing_title || v.rent_room?.property?.name || '', contactName: v.lead?.name || '', kind: 'viewing', status: 'confirmed' })) },
      inventory: { status: inventoryStatus, available, unavailable: rooms.length - available,
        published: rooms.filter(room => room.visibility === 'published').length,
        private: rooms.filter(room => room.visibility === 'private').length,
        preview: [...rooms].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime() || b.id - a.id).slice(0, 5).map(room => ({
          id: room.id, title: room.listing_title || room.property?.name || room.room_id || '',
          beds: Number(room.layout_values?.find(v => v.layout?.code === 'bedroom')?.value || 0),
          area: room.property?.district || '',
          price: room.price_rows?.length ? Math.min(...room.price_rows.map(price => Number(price.price))) : 0,
          availability: room.dealStatus === 'available' ? 'available' : 'unavailable',
          visibility: room.visibility === 'published' ? 'published' : 'private',
        })) },
      clients: { status: clientsStatus, draft, signing, tenants: active, renewal: renewals[0] ?? null },
      rent: { status: sectionStatus(billResult), periodYear: year, periodMonth: month,
        totalDue: moneyTotal(monthBills), received: moneyTotal(monthBills.filter(b => b.status === 'paid')),
        overdue: moneyTotal(monthBills.filter(b => b.status !== 'paid' && today > b.grace_until)), currency: 'THB' },
      commission: { status: 'not_configured', periodYear: year, periodMonth: month, total: 0, received: 0, pending: 0, currency: 'THB' },
      activity: { status: sectionStatus(leadResult, contractResult, billResult), items: activity.slice(0, 8) },
    };
  }
}
