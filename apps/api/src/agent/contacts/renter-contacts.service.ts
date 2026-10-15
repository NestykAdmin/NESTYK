import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { LeadEntity } from '../../entities/lead.entity';
import { TenantEntity } from '../../entities/tenant.entity';
import { contactUpdate } from '../rooms/contact-input';
import { contactDirectoryRows, type ContactPageOptions } from './contact-pagination';
import { rentalHistorySql } from './rental-history';

export type RenterContactKind = 'lead' | 'tenant';
export function renterContactKind(value: string): RenterContactKind {
  if (value !== 'lead' && value !== 'tenant') throw new BadRequestException('Invalid contact kind');
  return value;
}

function updateChannel(channels: LeadEntity['other_contacts'], channel: 'line' | 'facebook', value: string | null) {
  // The directory exposes one field per channel: clearing it must not reveal a second saved value.
  if (!value) return (channels ?? []).filter(item => item.channel !== channel);
  const next = [...(channels ?? [])], index = next.findIndex(item => item.channel === channel);
  if (index >= 0) {
    next[index] = { channel, value };
  } else next.push({ channel, value });
  return next;
}

@Injectable()
export class RenterContactsService {
  constructor(private readonly db: DataSource) {}

  async list(agentId: number, kind: RenterContactKind, options?: ContactPageOptions) {
    const query = kind === 'tenant'
      ? `SELECT t.id, t.name, t.phone, 0 AS "roomCount" FROM tenants t
         WHERE t.created_by_user_id = $1 AND ${rentalHistorySql({ tenantId: 't.id' })} ORDER BY t.name ASC, t.id ASC`
      : `SELECT l.id, l.name, l.phone, 0 AS "roomCount" FROM leads l
         WHERE l.created_by_user_id = $1 AND NOT EXISTS (
           SELECT 1 FROM tenants t WHERE t.lead_id = l.id
             AND t.created_by_user_id = $1 AND ${rentalHistorySql({ tenantId: 't.id' })}) ORDER BY l.name ASC, l.id ASC`;
    return contactDirectoryRows(this.db, query, [agentId], options);
  }

  private async person(manager: EntityManager, agentId: number, kind: RenterContactKind, id: number, lock = false) {
    const tenant = kind === 'tenant' ? await manager.findOne(TenantEntity, { where: { id, created_by_user_id: agentId } }) : null;
    if (kind === 'tenant' && !tenant) throw new NotFoundException('Contact not found');
    // Keep the lead-before-tenant lock order of booking and contract workflows.
    const lead = await manager.findOne(LeadEntity, {
      where: { id: tenant?.lead_id ?? id, created_by_user_id: agentId },
      ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
    if (!lead) throw new NotFoundException('Contact not found');
    const linked = await manager.findOne(TenantEntity, {
      where: { lead_id: lead.id, created_by_user_id: agentId },
      ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
    if (kind === 'tenant' && linked?.id !== id) throw new NotFoundException('Contact not found');
    return { lead, tenant: linked };
  }

  async get(agentId: number, kind: RenterContactKind, id: number) {
    const { lead, tenant } = await this.person(this.db.manager, agentId, kind, id);
    const row = kind === 'tenant' ? tenant! : lead;
    return { id: row.id, name: row.name, phone: row.phone, email: row.email,
      lineId: lead.other_contacts?.find(c => c.channel === 'line')?.value ?? null,
      facebook: lead.other_contacts?.find(c => c.channel === 'facebook')?.value ?? null,
      note: kind === 'tenant' ? tenant!.note : lead.notes };
  }

  async update(agentId: number, kind: RenterContactKind, id: number, input: unknown) {
    const patch = contactUpdate(input, { lineId: 255 });
    if (patch.phone?.startsWith('+') && !/^\+[1-9]\d{6,14}$/.test(patch.phone.replace(/[\s().-]/g, ''))) {
      throw new BadRequestException('Invalid international phone number');
    }
    await this.db.transaction(async manager => {
      const { lead, tenant } = await this.person(manager, agentId, kind, id, true);
      const common: Partial<Pick<LeadEntity, 'name' | 'first_name' | 'last_name' | 'phone' | 'email'>> = {};
      if (patch.name !== undefined) {
        const [first, ...last] = patch.name.trim().split(/\s+/);
        Object.assign(common, { name: [first, ...last].join(' '), first_name: first, last_name: last.join(' ') });
      }
      if (patch.phone !== undefined) common.phone = patch.phone.startsWith('+') ? patch.phone.replace(/[\s().-]/g, '') : patch.phone;
      if (patch.email !== undefined) common.email = patch.email;
      let channels = lead.other_contacts;
      if (patch.line_id !== undefined) channels = updateChannel(channels, 'line', patch.line_id);
      if (patch.facebook !== undefined) channels = updateChannel(channels, 'facebook', patch.facebook);
      if ((channels?.length ?? 0) > 5) throw new BadRequestException('At most 5 contact channels are supported');
      await manager.update(LeadEntity, { id: lead.id, created_by_user_id: agentId }, {
        ...common, ...(patch.note !== undefined ? { notes: patch.note } : {}),
        ...(channels !== lead.other_contacts ? { other_contacts: channels } : {}),
      });
      if (tenant && (Object.keys(common).length || patch.note !== undefined)) {
        await manager.update(TenantEntity, { id: tenant.id, created_by_user_id: agentId }, {
          ...common, ...(patch.note !== undefined ? { note: patch.note } : {}),
        });
      }
    });
    return this.get(agentId, kind, id);
  }
}
