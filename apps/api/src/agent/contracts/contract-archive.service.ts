import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { ContractArchiveDetail, ContractArchiveEntry, ContractArchiveKind, ContractArchivePage, ContractArchiveType, FinancialDocumentInput } from '@nestyk/types';
import { AgentContractsService } from './agent-contracts.service';
import { ContractDocumentStorageService } from './contract-document-storage.service';
import { financialTotals } from './financial-document';

const types: ContractArchiveType[] = ['reservation', 'lease', 'renewal', 'broker_appointment', 'booking_invoice', 'invoice', 'receipt', 'agent_commission'];
const kinds: ContractArchiveKind[] = ['contract', 'booking_invoice', 'booking_receipt', 'invoice', 'receipt', 'commission'];
export function archiveOptions(query: Record<string, unknown>) {
  if (Object.keys(query).some(key => !['type', 'q', 'page', 'limit'].includes(key)) || !types.includes(query.type as ContractArchiveType)) {
    throw new BadRequestException('Invalid document type');
  }
  const integer = (value: unknown, fallback: number, max: number) => {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || Number(value) > max) throw new BadRequestException('Invalid pagination');
    return Number(value);
  };
  if (query.q !== undefined && (typeof query.q !== 'string' || query.q.length > 255 || query.q.includes('\0'))) throw new BadRequestException('Invalid search');
  return { type: query.type as ContractArchiveType, q: (query.q as string | undefined)?.trim() ?? '', page: integer(query.page, 1, 2147483647), limit: integer(query.limit, 20, 50) };
}

// Every source is scoped before union/search/pagination. No storage paths or form data leave the mapper.
const directory = `WITH contracts AS (
  SELECT c.*, COALESCE(t.form_kind, a.form_kind, 'lease') AS form_kind,
    COALESCE(NULLIF(c.contract_no, ''), 'EC-' || c.id) AS document_no,
    CASE WHEN COALESCE(t.form_kind, a.form_kind, 'lease') = 'broker_appointment'
      THEN COALESCE(NULLIF(c.data #>> '{brokerAppointment,landlordName}', ''), '')
      ELSE COALESCE(NULLIF(c.party_snapshot->>'tenantName', ''), tenant.name, '') END AS person,
    COALESCE(NULLIF(c.party_snapshot->>'property', ''), p.name, r.listing_title) AS property,
    COALESCE(NULLIF(c.party_snapshot->>'room', ''), r.room_id) AS room
  FROM lease_contracts c
  LEFT JOIN agreement_templates t ON t.id = c.template_id
  LEFT JOIN master_agreement_types a ON a.code = c.agreement_type_code
  LEFT JOIN rent_rooms r ON r.id = c.rent_room_id
  LEFT JOIN properties p ON p.id = r.properties_id
  LEFT JOIN tenants tenant ON tenant.id = c.tenant_id
  WHERE c.created_by_user_id = $1
), archive AS (
  SELECT id, 'contract' AS kind, form_kind AS type, document_no, person, property, room,
    NULL::text AS reference,
    COALESCE(NULLIF(data->(CASE form_kind WHEN 'reservation' THEN 'reservationLetter' WHEN 'renewal' THEN 'leaseRenewal' WHEN 'broker_appointment' THEN 'brokerAppointment' ELSE 'leaseAgreement' END)->>'issueDate', ''), start_date::text) AS issue_date,
    status::text AS status, CASE WHEN form_kind = 'reservation' THEN reservation_fee WHEN form_kind IN ('lease', 'renewal') THEN monthly_rent END AS amount,
    NULL::jsonb AS financial, NULL::text AS path FROM contracts
  UNION ALL
  SELECT id, 'booking_invoice', 'booking_invoice', data #>> '{financialDocuments,invoice,documentNo}', person, property, room, document_no,
    COALESCE(NULLIF(data #>> '{financialDocuments,invoice,issueDate}', ''), start_date::text),
    CASE WHEN receipt_url IS NOT NULL THEN 'paid' WHEN data #>> '{reservationPayment,slipPath}' IS NOT NULL THEN 'submitted' ELSE 'unpaid' END,
    NULL, data #> '{financialDocuments,invoice}', invoice_url FROM contracts
    WHERE form_kind = 'reservation' AND invoice_url IS NOT NULL AND data #>> '{financialDocuments,invoice,documentNo}' IS NOT NULL
  UNION ALL
  SELECT id, 'booking_receipt', 'receipt', data #>> '{financialDocuments,receipt,documentNo}', person, property, room, data #>> '{financialDocuments,invoice,documentNo}',
    COALESCE(NULLIF(data #>> '{financialDocuments,receipt,issueDate}', ''), start_date::text), 'paid', NULL,
    data #> '{financialDocuments,receipt}', receipt_url FROM contracts
    WHERE form_kind = 'reservation' AND receipt_url IS NOT NULL AND data #>> '{financialDocuments,receipt,documentNo}' IS NOT NULL
  UNION ALL
  SELECT id, 'invoice', 'invoice', document_no, customer_name, NULL, NULL, NULLIF(data->>'reference', ''), issue_date::text,
    CASE WHEN receipt_document_no IS NOT NULL THEN 'paid' ELSE 'unpaid' END, NULL, data, pdf_path
    FROM agent_invoices WHERE created_by_user_id = $1
  UNION ALL
  SELECT id, 'receipt', 'receipt', receipt_document_no, customer_name, NULL, NULL, document_no,
    COALESCE(receipt_issue_date, issue_date)::text, 'paid', NULL, COALESCE(receipt_data, data), receipt_pdf_path
    FROM agent_invoices WHERE created_by_user_id = $1 AND receipt_pdf_path IS NOT NULL AND receipt_document_no IS NOT NULL
  UNION ALL
  SELECT id, 'commission', 'agent_commission', document_no, landlord_name, NULL, NULL, NULLIF(data->>'tenantName', ''), issue_date::text,
    CASE WHEN pdf_path IS NULL OR pdf_path = '' THEN 'draft' ELSE 'ready' END, NULL, NULL, pdf_path
    FROM agent_commission_confirmations WHERE created_by_user_id = $1
)`;
type Row = { id: number; kind: ContractArchiveKind; type: ContractArchiveType; document_no: string; person: string; property: string | null; room: string | null; reference: string | null; issue_date: string; status: string; amount: number | string | null; financial: FinancialDocumentInput | null; path: string | null };
function summary(row: Row): ContractArchiveEntry {
  return { id: row.id, key: `${row.kind}:${row.id}`, kind: row.kind, type: row.type, documentNo: row.document_no,
    person: row.person, property: row.property, room: row.room, reference: row.reference, issueDate: row.issue_date, status: row.status,
    amount: row.financial ? financialTotals(row.financial).total : row.amount == null ? null : Number(row.amount) };
}
@Injectable()
export class ContractArchiveService {
  constructor(private readonly db: DataSource, private readonly contracts: AgentContractsService, private readonly documents: ContractDocumentStorageService) {}
  async list(agentId: number, query: Record<string, unknown>): Promise<ContractArchivePage> {
    const options = archiveOptions(query);
    const pattern = `%${options.q.replace(/[\\%_]/g, '\\$&')}%`;
    const [result]: Array<{ total: number; items: Row[] }> = await this.db.query(`${directory}, filtered AS (
      SELECT * FROM archive WHERE type = $2 AND ($3 = '' OR concat_ws(' ', document_no, person, property, room, reference) ILIKE $4 ESCAPE '\\')
    ), selected_page AS (SELECT * FROM filtered ORDER BY issue_date DESC, id DESC, kind ASC LIMIT $5 OFFSET $6)
    SELECT (SELECT COUNT(*)::int FROM filtered) AS total,
      COALESCE(json_agg(selected_page ORDER BY issue_date DESC, id DESC, kind ASC), '[]'::json) AS items FROM selected_page`,
    [agentId, options.type, options.q, pattern, options.limit, (options.page - 1) * options.limit]);
    return { items: result.items.map(summary), total: Number(result.total), page: options.page, limit: options.limit };
  }
  async detail(agentId: number, kind: string, id: number): Promise<ContractArchiveDetail> {
    if (!kinds.includes(kind as ContractArchiveKind)) throw new BadRequestException('Invalid document kind');
    const [row]: Row[] = await this.db.query(`${directory} SELECT * FROM archive WHERE kind = $2 AND id = $3`, [agentId, kind, id]);
    if (!row) throw new NotFoundException('Document not found');
    let documentUrl: string | null = null;
    if (kind === 'contract') {
      // Reuse the signing/signature rules of the existing contract detail endpoint.
      const contract = await this.contracts.view(agentId, id);
      documentUrl = row.type === 'reservation' ? contract.reservationLetterUrl : row.type === 'broker_appointment' ? contract.brokerAppointmentUrl : contract.leaseDocumentUrl;
    } else if (row.path) {
      documentUrl = (await this.documents.signPaths([row.path])).get(row.path) ?? null;
    }
    return { ...summary(row), documentUrl };
  }
}
