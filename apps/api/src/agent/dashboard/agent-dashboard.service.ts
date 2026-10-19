import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { AgentDashboardData, DashboardWorkItem, DashboardWorkPage } from '@nestyk/types';
import { bangkokToday } from '../../billing/rent-schedule';
import { dashboardQuery, dashboardSources } from './dashboard-query';

type SqlWork = Omit<DashboardWorkItem, 'amount'> & { amount: string | number | null };
const workItem = (row: SqlWork): DashboardWorkItem => ({ ...row, amount: row.amount == null ? null : Number(row.amount) });
@Injectable()
export class AgentDashboardService {
  constructor(private readonly db: DataSource) {}
  private async read(sql: string, args: unknown[]) {
    try { return await this.db.query(sql, args); }
    catch { throw new ServiceUnavailableException('Dashboard temporarily unavailable'); }
  }
  async summary(agentId: number, query: Record<string, unknown>, now = new Date()): Promise<AgentDashboardData> {
    const today = bangkokToday(now), { period } = dashboardQuery(query, today);
    const [row] = await this.read(`${dashboardSources}, activity AS (
      SELECT 'lead:' || id AS id, 'lead_added' AS kind, name AS subject, created_at AS at,
        json_build_object('type','action','id','viewLead','leadId',id) AS "deepLink" FROM scoped_leads
      UNION ALL
      SELECT 'contract:' || id, 'contract_sent', property, greatest(owner_delivered_at,tenant_delivered_at),
        json_build_object('type','action','id','viewClient','tenantId',tenant_id,'contractId',id,'section','contracts')
        FROM contracts WHERE owner_delivered_at IS NOT NULL OR tenant_delivered_at IS NOT NULL
      UNION ALL
      SELECT 'payment:' || id, 'payment_recorded', person, paid_at,
        json_build_object('type','action','id','viewClient','tenantId',tenant_id,'contractId',contract_id,'section','bills')
        FROM bills WHERE status = 'paid' AND paid_at IS NOT NULL
    ), appointments AS (
      SELECT v.id::text AS id, v.scheduled_at AS "startsAt", COALESCE(p.name,r.listing_title,'') AS title, l.name AS "contactName", 'viewing' AS kind, v.status AS status
      FROM lead_viewings v JOIN leads l ON l.id = v.lead_id AND l.created_by_user_id = $1
      JOIN rent_rooms r ON r.id = v.rent_room_id AND r.created_by_user_id = $1
      LEFT JOIN properties p ON p.id = r.properties_id CROSS JOIN clock
      WHERE v.created_by_user_id = $1 AND v.status <> 'cancelled'
        AND v.scheduled_at >= (clock.today::timestamp AT TIME ZONE 'Asia/Bangkok') AND v.scheduled_at < ((clock.today + 1)::timestamp AT TIME ZONE 'Asia/Bangkok')
      UNION ALL
      SELECT 'event-' || e.id, e.starts_at, e.title, e.location, 'custom', CASE WHEN e.status IN ('pending','confirmed') THEN 'scheduled' ELSE e.status END
      FROM agent_calendar_events e CROSS JOIN clock
      WHERE e.created_by_user_id = $1 AND e.status <> 'cancelled'
        AND e.starts_at >= (clock.today::timestamp AT TIME ZONE 'Asia/Bangkok') AND e.starts_at < ((clock.today + 1)::timestamp AT TIME ZONE 'Asia/Bangkok')
    )
    SELECT
      (SELECT json_build_object('available',count(*) FILTER(WHERE room_status='available'), 'total',count(*),
        'unavailable',count(*) FILTER(WHERE room_status IS DISTINCT FROM 'available'), 'published',count(*) FILTER(WHERE visibility='published'),
        'private',count(*) FILTER(WHERE visibility='private')) FROM rooms) AS inventory,
      (SELECT count(*)::int FROM scoped_leads WHERE status IN ('new','inprogress')) AS "openLeads",
      (SELECT json_build_object('total',count(*), 'tenants',count(*) FILTER(WHERE renting),
        'signing',count(*) FILTER(WHERE NOT renting AND signing), 'draft',count(*) FILTER(WHERE NOT renting AND NOT signing)) FROM current_clients) AS clients,
      (SELECT coalesce(json_agg(preview ORDER BY preview.updated_at DESC, preview.id DESC),'[]'::json) FROM
        (SELECT id,title,area,beds,price,room_status,visibility,updated_at FROM rooms ORDER BY updated_at DESC,id DESC LIMIT 2) preview) AS preview,
      (SELECT coalesce(json_agg(appointments ORDER BY "startsAt",id),'[]'::json) FROM appointments) AS schedule,
      (SELECT count(*)::int FROM appointments) AS "scheduleTotal",
      (SELECT coalesce(json_agg(a ORDER BY at DESC,id DESC),'[]'::json) FROM (SELECT * FROM activity WHERE at <= $3::timestamptz ORDER BY at DESC,id DESC LIMIT 3) a) AS activity,
      (SELECT coalesce(json_agg(w),'[]'::json) FROM (SELECT kind,count(*)::int AS count,coalesce(sum(amount),0) AS amount FROM work WHERE kind <> 'rent' GROUP BY kind) w) AS actions,
      (SELECT json_build_object('totalDue',coalesce(sum(amount),0), 'received',coalesce(sum(amount) FILTER(WHERE status='paid'),0),
        'unpaid',coalesce(sum(amount) FILTER(WHERE status<>'paid'),0),
        'overdue',coalesce(sum(amount) FILTER(WHERE status<>'paid' AND grace_until < clock.today),0),
        'pending',coalesce(sum(amount) FILTER(WHERE status<>'paid' AND grace_until >= clock.today),0))
        FROM bills CROSS JOIN clock WHERE to_char(due_date,'YYYY-MM')=clock.period) AS rent,
      (SELECT json_build_object('id',id::text,'tenantId',tenant_id,'title',concat_ws(' · ',property,room),'endsAt',end_date::text,'daysLeft',end_date-clock.today)
        FROM renewals CROSS JOIN clock ORDER BY end_date,id LIMIT 1) AS renewal
    `, [agentId, today, now.toISOString(), period]);
    const [year, month] = period.split('-').map(Number);
    const actions = new Map<string, { count: number; amount: number }>(row.actions.map((item: { kind: string; count: number; amount: number }) => [item.kind, item]));
    const actionKinds = ['overdue_payment', 'awaiting_signature', 'renewal'] as const;
    return {
      computedAt: now.toISOString(), today, timezone: 'Asia/Bangkok', period,
      business: { status: 'available', availableListings: Number(row.inventory.available), totalListings: Number(row.inventory.total), openLeads: Number(row.openLeads),
        currentClients: Number(row.clients.total), tenantsCount: Number(row.clients.tenants), commissionPending: null, currency: 'THB' },
      actionRequired: { status: 'available', items: [
        ...actionKinds.map(kind => ({ id: kind, kind, status: 'available' as const, count: Number(actions.get(kind)?.count ?? 0),
          ...(kind === 'overdue_payment' ? { amount: Number(actions.get(kind)?.amount ?? 0) } : {}),
          deepLink: { type: 'tab' as const, tab: 'clients' as const, filter: { kind: 'work' as const, work: kind } } })),
        { id: 'lead_follow_up', kind: 'lead_follow_up', status: 'not_configured', count: null, deepLink: { type: 'tab', tab: 'listingLead' } },
      ] },
      schedule: { status: 'available', total: Number(row.scheduleTotal), items: row.schedule },
      inventory: { status: 'available', available: Number(row.inventory.available), unavailable: Number(row.inventory.unavailable), published: Number(row.inventory.published), private: Number(row.inventory.private),
        preview: row.preview.map((r: { id: number; title: string; beds: number | null; area: string; price: string | null; room_status: string; visibility: string | null }) => ({
          id: r.id, title: r.title, beds: r.beds, area: r.area, price: r.price == null ? null : Number(r.price), availability: r.room_status === 'available' ? 'available' : 'unavailable', visibility: r.visibility === 'published' ? 'published' : r.visibility === 'private' ? 'private' : null,
        })) },
      clients: { status: 'available', draft: Number(row.clients.draft), signing: Number(row.clients.signing), tenants: Number(row.clients.tenants), renewal: row.renewal },
      rent: { status: 'available', periodYear: year!, periodMonth: month!, totalDue: Number(row.rent.totalDue), received: Number(row.rent.received), overdue: Number(row.rent.overdue), pending: Number(row.rent.pending), unpaid: Number(row.rent.unpaid), currency: 'THB' },
      commission: { status: 'not_configured', periodYear: year!, periodMonth: month!, total: null, received: null, pending: null, currency: 'THB' },
      activity: { status: 'available', items: row.activity },
    };
  }
  async workItems(agentId: number, query: Record<string, unknown>, now = new Date()): Promise<DashboardWorkPage> {
    const today = bangkokToday(now), options = dashboardQuery(query, today, true);
    const pattern = `%${options.q.replace(/[\\%_]/g, '\\$&')}%`;
    const [result]: Array<{ items: SqlWork[]; total: number }> = await this.read(`${dashboardSources}, filtered AS (
      SELECT * FROM work WHERE kind = $5 AND ($6 = '' OR concat_ws(' ',person,property,room,"documentNo") ILIKE $7 ESCAPE '\\')
    ), selected_page AS (SELECT * FROM filtered ORDER BY date ASC,id ASC LIMIT $8 OFFSET $9)
    SELECT (SELECT count(*)::int FROM filtered) AS total, coalesce(json_agg(selected_page ORDER BY date ASC,id ASC),'[]'::json) AS items FROM selected_page`,
    [agentId, today, now.toISOString(), options.period, options.kind, options.q, pattern, options.limit, (options.page - 1) * options.limit]);
    return { items: result.items.map(workItem), total: Number(result.total), page: options.page, limit: options.limit };
  }
}
