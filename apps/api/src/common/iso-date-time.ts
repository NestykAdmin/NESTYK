import { BadRequestException } from '@nestjs/common';

export function parseZonedInstant(value: unknown): Date {
  const parts = typeof value === 'string' ? /^(\d{4})-(\d{2})-(\d{2})T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(value) : null;
  if (!parts || !Number.isFinite(Date.parse(value as string))) throw new BadRequestException('Expected an ISO date-time with timezone');
  const [, year, month, day] = parts.map(Number);
  if (!year || month! < 1 || month! > 12 || day! < 1 || day! > new Date(Date.UTC(year!, month!, 0)).getUTCDate()) throw new BadRequestException('Invalid calendar date');
  return new Date(value as string);
}
