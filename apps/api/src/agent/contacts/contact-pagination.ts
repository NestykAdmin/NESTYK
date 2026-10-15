import { BadRequestException } from '@nestjs/common';
import type { DataSource } from 'typeorm';

export type ContactPageOptions = { page: number; limit: number; q: string };
type DirectoryRow = { id: number; name: string; phone: string; roomCount: number | string };

/** Calls without query options retain the array response used by existing pickers. */
export function contactPageOptions(query: Record<string, unknown>): ContactPageOptions | undefined {
  if (Object.keys(query).some(key => !['page', 'limit', 'q'].includes(key))) {
    throw new BadRequestException('Unsupported contact query');
  }
  if (query.page === undefined && query.limit === undefined && query.q === undefined) return undefined;
  const integer = (value: unknown, fallback: number, max: number) => {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || Number(value) > max) {
      throw new BadRequestException('Invalid contact pagination');
    }
    return Number(value);
  };
  if (query.q !== undefined && (typeof query.q !== 'string' || query.q.length > 255 || query.q.includes('\u0000'))) {
    throw new BadRequestException('Invalid contact search');
  }
  return { page: integer(query.page, 1, 2147483647), limit: integer(query.limit, 20, 50), q: (query.q as string | undefined)?.trim() ?? '' };
}

export async function contactDirectoryRows(db: Pick<DataSource, 'query'>, sql: string, values: unknown[], options?: ContactPageOptions) {
  const normalize = (row: DirectoryRow) => ({ ...row, roomCount: Number(row.roomCount) || 0 });
  if (!options) {
    const rows: DirectoryRow[] = await db.query(sql, values);
    return rows.map(normalize);
  }
  const params = [...values];
  const bind = (value: unknown) => { params.push(value); return `$${params.length}`; };
  const escape = (value: string) => value.replace(/[\\%_]/g, '\\$&');
  const search = bind(options.q), name = bind(`%${escape(options.q)}%`);
  const phoneQuery = options.q.replace(/[\s()+.-]/g, '');
  const phone = bind(phoneQuery), phonePattern = bind(`%${escape(phoneQuery)}%`);
  const limit = bind(options.limit), offset = bind((options.page - 1) * options.limit);
  // One statement keeps the count and page in the same database snapshot, even for an empty page.
  const [result]: Array<{ total: number; items: DirectoryRow[] }> = await db.query(`
    WITH directory AS (${sql}), filtered AS (
      SELECT * FROM directory WHERE ${search} = '' OR name ILIKE ${name} ESCAPE '\\'
        OR (${phone} <> '' AND regexp_replace(phone, '[[:space:]()+.-]', '', 'g') LIKE ${phonePattern} ESCAPE '\\')
    ), selected_page AS (
      SELECT * FROM filtered ORDER BY name ASC, id ASC LIMIT ${limit} OFFSET ${offset}
    )
    SELECT (SELECT COUNT(*)::int FROM filtered) AS total,
      COALESCE(json_agg(selected_page ORDER BY name ASC, id ASC), '[]'::json) AS items FROM selected_page
  `, params);
  return { items: result.items.map(normalize), total: Number(result.total), page: options.page, limit: options.limit };
}
