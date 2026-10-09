import type { DataSource } from 'typeorm';

export interface EntityColumnSpec {
  column: string;
  /** TypeORM's normalized Postgres type, e.g. `character varying`, `timestamp with time zone`. */
  type: string;
  isArray: boolean;
  nullable: boolean;
}

export interface EntityTableSpec {
  table: string;
  columns: EntityColumnSpec[];
}

/** One row of `information_schema.columns`. */
export interface DbColumn {
  table: string;
  column: string;
  dataType: string;
  udtName: string;
  nullable: boolean;
}

export type SchemaDriftIssue =
  | { kind: 'missing_table'; table: string }
  | { kind: 'missing_column'; table: string; column: string }
  | { kind: 'type_mismatch'; table: string; column: string; expected: string; actual: string }
  | { kind: 'nullable_mismatch'; table: string; column: string; expected: boolean; actual: boolean }
  | { kind: 'extra_column'; table: string; column: string };

/** DB columns no entity maps are legacy/unused, not breakage. */
export function isSchemaDriftError(issue: SchemaDriftIssue): boolean {
  return issue.kind !== 'extra_column';
}

export function entityTableSpecs(dataSource: DataSource): EntityTableSpec[] {
  return dataSource.entityMetadatas
    .filter((meta) => meta.tableType === 'regular')
    .map((meta) => ({
      table: meta.tableName,
      columns: meta.columns.map((col) => ({
        column: col.databaseName,
        type: String(dataSource.driver.normalizeType(col)).toLowerCase(),
        isArray: col.isArray,
        nullable: col.isNullable,
      })),
    }));
}

function actualType(col: DbColumn): string {
  return col.dataType === 'USER-DEFINED' ? col.udtName : col.dataType.toLowerCase();
}

function typeMatches(spec: EntityColumnSpec, col: DbColumn): boolean {
  if (spec.isArray) return col.dataType === 'ARRAY';
  // Enums are either a Postgres enum type or a varchar guarded by a CHECK.
  if (spec.type === 'enum') return col.dataType === 'USER-DEFINED' || col.dataType === 'character varying';
  return spec.type === actualType(col);
}

export function compareSchema(entities: EntityTableSpec[], dbColumns: DbColumn[]): SchemaDriftIssue[] {
  const db = new Map<string, Map<string, DbColumn>>();
  for (const col of dbColumns) {
    if (!db.has(col.table)) db.set(col.table, new Map());
    db.get(col.table)!.set(col.column, col);
  }

  const issues: SchemaDriftIssue[] = [];
  for (const entity of entities) {
    const table = db.get(entity.table);
    if (!table) {
      issues.push({ kind: 'missing_table', table: entity.table });
      continue;
    }
    for (const spec of entity.columns) {
      const col = table.get(spec.column);
      if (!col) {
        issues.push({ kind: 'missing_column', table: entity.table, column: spec.column });
        continue;
      }
      if (!typeMatches(spec, col)) {
        issues.push({
          kind: 'type_mismatch',
          table: entity.table,
          column: spec.column,
          expected: spec.isArray ? `${spec.type}[]` : spec.type,
          actual: col.dataType === 'ARRAY' ? `${col.udtName.replace(/^_/, '')}[]` : actualType(col),
        });
      }
      if (spec.nullable !== col.nullable) {
        issues.push({
          kind: 'nullable_mismatch',
          table: entity.table,
          column: spec.column,
          expected: spec.nullable,
          actual: col.nullable,
        });
      }
    }
    const mapped = new Set(entity.columns.map((spec) => spec.column));
    for (const column of table.keys()) {
      if (!mapped.has(column)) issues.push({ kind: 'extra_column', table: entity.table, column });
    }
  }
  return issues;
}

export async function readDbColumns(dataSource: DataSource, schema: string): Promise<DbColumn[]> {
  const rows: Array<{ table_name: string; column_name: string; data_type: string; udt_name: string; is_nullable: string }> =
    await dataSource.query(
      `SELECT table_name, column_name, data_type, udt_name, is_nullable
         FROM information_schema.columns
        WHERE table_schema = $1`,
      [schema],
    );
  return rows.map((row) => ({
    table: row.table_name,
    column: row.column_name,
    dataType: row.data_type,
    udtName: row.udt_name,
    nullable: row.is_nullable === 'YES',
  }));
}

export async function checkSchemaDrift(dataSource: DataSource, schema: string): Promise<SchemaDriftIssue[]> {
  return compareSchema(entityTableSpecs(dataSource), await readDbColumns(dataSource, schema));
}

export function describeSchemaDrift(issue: SchemaDriftIssue): string {
  switch (issue.kind) {
    case 'missing_table':
      return `ขาดตาราง ${issue.table}`;
    case 'missing_column':
      return `ขาดคอลัมน์ ${issue.table}.${issue.column}`;
    case 'type_mismatch':
      return `ชนิดข้อมูลไม่ตรง ${issue.table}.${issue.column} (entity: ${issue.expected}, ฐานข้อมูล: ${issue.actual})`;
    case 'nullable_mismatch':
      return `การยอมให้ค่าว่างไม่ตรง ${issue.table}.${issue.column} (entity: ${issue.expected ? 'NULL ได้' : 'NOT NULL'}, ฐานข้อมูล: ${issue.actual ? 'NULL ได้' : 'NOT NULL'})`;
    case 'extra_column':
      return `มีคอลัมน์ในฐานข้อมูลที่ entity ไม่ได้ใช้ ${issue.table}.${issue.column}`;
  }
}

export interface MigrationFile {
  name: string;
  sql: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Matches `name`, `"name"` or `schema.name` as a whole SQL identifier. */
function identifier(name: string): string {
  return `(?:"?[\\w]+"?\\.)?"?${escapeRegExp(name)}"?(?![\\w])`;
}

/**
 * Migration files (sorted by name, i.e. date) that create what is missing: for a missing table every file
 * that creates or alters it, for a missing column the files that add it. Only missing tables/columns are
 * matched — type and nullability changes can lose data and are left to a person.
 */
export function migrationsForDrift(issues: SchemaDriftIssue[], migrations: MigrationFile[]): string[] {
  const picked = new Set<string>();
  const creates = new Set<string>();
  for (const issue of issues) {
    if (issue.kind !== 'missing_table' && issue.kind !== 'missing_column') continue;
    const table = identifier(issue.table);
    const createsTable = new RegExp(`CREATE\\s+TABLE(?:\\s+IF\\s+NOT\\s+EXISTS)?\\s+${table}`, 'i');
    const altersTable = new RegExp(`ALTER\\s+TABLE(?:\\s+IF\\s+EXISTS)?(?:\\s+ONLY)?\\s+${table}`, 'i');
    const addsColumn =
      issue.kind === 'missing_column'
        ? new RegExp(`ADD\\s+(?:COLUMN\\s+)?(?:IF\\s+NOT\\s+EXISTS\\s+)?"?${escapeRegExp(issue.column)}"?(?![\\w])`, 'i')
        : null;
    for (const file of migrations) {
      const creating = createsTable.test(file.sql);
      if (!creating && !altersTable.test(file.sql)) continue;
      if (addsColumn && !addsColumn.test(file.sql)) continue;
      picked.add(file.name);
      if (creating && issue.kind === 'missing_table') creates.add(file.name);
    }
  }
  // Same-day files sort by name, so a table's CREATE must be forced ahead of the ALTERs that need it.
  return [...picked].sort((a, b) => Number(creates.has(b)) - Number(creates.has(a)) || a.localeCompare(b));
}

/** Issues no migration file covers. */
export function uncoveredDrift(issues: SchemaDriftIssue[], migrations: MigrationFile[]): SchemaDriftIssue[] {
  return issues.filter(
    (issue) =>
      isSchemaDriftError(issue) &&
      !migrationsForDrift([issue], migrations).length,
  );
}
