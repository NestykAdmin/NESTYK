import { BadRequestException } from '@nestjs/common';
import type { ContactEntity } from '../../entities/contact.entity';

const FIELDS = {
  name: { column: 'name', max: 255, required: true },
  phone: { column: 'phone', max: 50, required: true },
  email: { column: 'email', max: 255, required: false },
  lineId: { column: 'line_id', max: 100, required: false },
  facebook: { column: 'facebook', max: 255, required: false },
  note: { column: 'note', max: 500, required: false },
} as const;

type ContactChanges = Partial<Pick<ContactEntity, 'name' | 'phone' | 'email' | 'line_id' | 'facebook' | 'note'>>;

export function contactUpdate(input: unknown, limits: { lineId?: number } = {}): ContactChanges {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new BadRequestException('Invalid contact details');
  }
  const entries = Object.entries(input);
  if (!entries.length) throw new BadRequestException('Contact details required');
  const result: Record<string, string | null> = {};
  for (const [key, value] of entries) {
    if (!Object.hasOwn(FIELDS, key)) throw new BadRequestException('Unknown contact field');
    const field = FIELDS[key as keyof typeof FIELDS];
    if (value !== null && typeof value !== 'string') throw new BadRequestException('Invalid contact field');
    // PostgreSQL text/varchar cannot store NUL; reject it as client input before querying.
    if (typeof value === 'string' && value.includes('\u0000')) throw new BadRequestException('Invalid contact field');
    const text = typeof value === 'string' ? value.trim() : '';
    if (text.length > (key === 'lineId' ? limits.lineId ?? field.max : field.max) || (field.required && !text)) {
      throw new BadRequestException('Invalid contact field length');
    }
    if (key === 'email' && text && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
      throw new BadRequestException('Invalid email address');
    }
    result[field.column] = text || null;
  }
  return result;
}
