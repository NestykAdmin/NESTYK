import { BadRequestException } from '@nestjs/common';
import type { DashboardWorkKind } from '@nestyk/types';
export function dashboardQuery(query: Record<string, unknown>, today: string, work = false) {
  const allowed = work ? ['period', 'kind', 'q', 'page', 'limit'] : ['period'];
  if (Object.entries(query).some(([key, value]) => !allowed.includes(key) || typeof value !== 'string')) throw new BadRequestException('Invalid dashboard query');
  const period = (query.period ?? today.slice(0, 7)) as string;
  if (!/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(period)) throw new BadRequestException('Invalid period');
  const integer = (value: unknown, fallback: number, max: number) => {
    if (value === undefined) return fallback;
    if (!/^[1-9]\d*$/.test(String(value)) || Number(value) > max) throw new BadRequestException('Invalid pagination');
    return Number(value);
  };
  const kind = query.kind as DashboardWorkKind;
  if (work && !['overdue_payment', 'awaiting_signature', 'renewal', 'rent'].includes(kind)) throw new BadRequestException('Unsupported work kind');
  const q = (query.q as string | undefined)?.trim() ?? '';
  if (q.length > 255 || q.includes('\0')) throw new BadRequestException('Invalid search');
  return { period, kind, q, page: integer(query.page, 1, 2147483647), limit: integer(query.limit, 20, 50) };
}
/** Shared source and predicates keep dashboard counts and paginated drill-downs consistent. */
export const dashboardSources = `WITH clock AS (
  SELECT $2::date AS today, $3::timestamptz AS at, $4::text AS period
), rooms AS (
  SELECT r.id, r.visibility, r.room_id, r.updated_at, s.code AS room_status,
    COALESCE(NULLIF(r.listing_title, ''), p.name, '') AS title,
    COALESCE(p.district, '') AS area, rt.bedroom_count AS beds,
    COALESCE((SELECT min(price) FROM rent_room_prices WHERE rent_room_id = r.id),
      (SELECT min((value->>'price')::numeric) FROM jsonb_array_elements(CASE WHEN jsonb_typeof(r.prices) = 'array' THEN r.prices ELSE '[]'::jsonb END)
        WHERE value->>'price' ~ '^\\d+(\\.\\d{1,2})?$')) AS price
  FROM rent_rooms r LEFT JOIN properties p ON p.id = r.properties_id
  LEFT JOIN master_room_statuses s ON s.id = r.room_status_id
  LEFT JOIN master_room_types rt ON rt.id = r.room_type_id
  WHERE r.created_by_user_id = $1 AND r.is_scout_room = true
), scoped_leads AS (
  SELECT id, name, status, created_at, tenant_id, rent_room_id, booking_released_at FROM leads WHERE created_by_user_id = $1
), contracts AS (
  SELECT c.id, c.tenant_id, c.rent_room_id, c.status, c.start_date, c.end_date, c.move_in_date, c.previous_agreement_id,
    c.owner_signed_at, c.tenant_signed_at, c.agent_signed_at, c.owner_signature_url, c.tenant_signature_url, c.agent_signature_url,
    c.owner_delivered_at, c.tenant_delivered_at, c.monthly_rent,
    COALESCE(t.form_kind, a.form_kind, 'lease') AS form_kind,
    COALESCE(c.contract_no, 'EC-' || c.id) AS document_no, tenant.name AS person,
    COALESCE(NULLIF(c.party_snapshot->>'property', ''), p.name, r.listing_title, '') AS property,
    COALESCE(NULLIF(c.party_snapshot->>'room', ''), r.room_id) AS room
  FROM lease_contracts c JOIN tenants tenant ON tenant.id = c.tenant_id AND tenant.created_by_user_id = $1
  LEFT JOIN agreement_templates t ON t.id = c.template_id LEFT JOIN master_agreement_types a ON a.code = c.agreement_type_code
  LEFT JOIN rent_rooms r ON r.id = c.rent_room_id LEFT JOIN properties p ON p.id = r.properties_id
  WHERE c.created_by_user_id = $1
), current_clients AS (
  SELECT c.tenant_id,
    bool_or(c.form_kind IN ('lease','renewal') AND c.status = 'active'
      AND COALESCE(c.move_in_date,c.start_date) <= clock.today AND (c.end_date IS NULL OR c.end_date >= clock.today)) AS renting,
    bool_or(c.status = 'awaiting_signatures') AS signing
  FROM contracts c CROSS JOIN clock WHERE c.form_kind IN ('reservation','lease','renewal') AND c.status NOT IN ('cancelled','expired','terminated')
    AND (c.status <> 'active'
      OR (c.form_kind IN ('lease','renewal') AND (c.end_date IS NULL OR c.end_date >= clock.today))
      OR (c.form_kind = 'reservation' AND NOT EXISTS (
        SELECT 1 FROM contracts stay WHERE stay.tenant_id = c.tenant_id AND stay.rent_room_id = c.rent_room_id
          AND stay.form_kind IN ('lease','renewal') AND stay.status <> 'cancelled')))
  GROUP BY c.tenant_id
  UNION ALL
  SELECT tenant.id, false, false FROM tenants tenant
    WHERE tenant.created_by_user_id = $1
      AND EXISTS (SELECT 1 FROM scoped_leads lead WHERE lead.tenant_id = tenant.id AND lead.status = 'booked' AND lead.booking_released_at IS NULL)
      AND NOT EXISTS (SELECT 1 FROM contracts c WHERE c.tenant_id = tenant.id)
), bills AS (
  SELECT b.id, b.lease_contract_id AS contract_id, b.tenant_id, b.document_no, b.due_date, b.grace_until,
    b.amount, b.status, b.paid_at, (b.payment_slip_path IS NOT NULL AND b.slip_submitted_at IS NOT NULL) AS awaiting_review,
    c.person, c.property, c.room
  FROM tenant_bills b JOIN contracts c ON c.id = b.lease_contract_id AND c.tenant_id = b.tenant_id
  WHERE c.form_kind IN ('lease','renewal')
), signing AS (
  SELECT c.* FROM contracts c WHERE c.status = 'awaiting_signatures' AND (
    c.owner_signed_at IS NULL OR c.owner_signature_url IS NULL OR
    (c.form_kind <> 'broker_appointment' AND (c.tenant_signed_at IS NULL OR c.tenant_signature_url IS NULL)) OR
    (c.form_kind IN ('reservation','broker_appointment') AND (c.agent_signed_at IS NULL OR c.agent_signature_url IS NULL)))
), renewals AS (
  SELECT c.* FROM contracts c CROSS JOIN clock WHERE c.status = 'active' AND c.form_kind IN ('lease','renewal')
    AND COALESCE(c.move_in_date,c.start_date) <= clock.today AND c.end_date BETWEEN clock.today AND clock.today + 30
    AND NOT EXISTS (SELECT 1 FROM contracts successor WHERE successor.previous_agreement_id = c.id AND successor.status <> 'cancelled')
), work AS (
  SELECT 'bill:' || b.id AS id, 'overdue_payment' AS kind, b.tenant_id AS "tenantId", b.contract_id AS "contractId", b.id AS "billId",
    b.person, b.property, b.room, b.document_no AS "documentNo", b.due_date::text AS date, b.amount, b.status, b.awaiting_review AS "awaitingReview"
    FROM bills b CROSS JOIN clock WHERE b.status <> 'paid' AND b.grace_until < clock.today
  UNION ALL
  SELECT 'signing:' || id, 'awaiting_signature', tenant_id, id, NULL, person, property, room, document_no, start_date::text, NULL, status, false FROM signing
  UNION ALL
  SELECT 'renewal:' || id, 'renewal', tenant_id, id, NULL, person, property, room, document_no, end_date::text, monthly_rent, status, false FROM renewals
  UNION ALL
  SELECT 'rent:' || b.id, 'rent', b.tenant_id, b.contract_id, b.id, b.person, b.property, b.room, b.document_no, b.due_date::text, b.amount,
    CASE WHEN b.status = 'paid' THEN 'paid' WHEN b.awaiting_review THEN 'awaiting_review' WHEN b.grace_until < clock.today THEN 'overdue' ELSE 'pending' END, b.awaiting_review
    FROM bills b CROSS JOIN clock WHERE to_char(b.due_date, 'YYYY-MM') = clock.period
)`;
