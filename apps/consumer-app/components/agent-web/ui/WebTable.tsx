import React, { useEffect, useRef } from "react";
import { MobileIcon, useMobileTheme } from "@nestyk/ui/native";
import { useLocale } from "@nestyk/i18n";
import { WebSkeleton, WebState, useOnline } from "./WebState";
import "./agent-web-ui.css";

export type WebSortDirection = "asc" | "desc";
export interface WebSort {
  key: string;
  direction: WebSortDirection;
}
export type WebRowKey = string | number;

export interface WebTableColumn<Row> {
  key: string;
  header: string;
  cell: (row: Row) => React.ReactNode;
  /** The header becomes a sort button. Sorting itself is the page's job (server or `sortRows`). */
  sortable?: boolean;
  /** Value `sortRows` compares (defaults to nothing: the column then keeps its order). */
  sortValue?: (row: Row) => string | number | null | undefined;
  align?: "start" | "center" | "end";
  width?: string;
  /** Hide the column on narrower screens: md = under 1024px, lg = under 1280px. */
  hideBelow?: "md" | "lg";
}

export type WebTableStatus = "ready" | "loading" | "error" | "forbidden";

export interface WebTableProps<Row> {
  /** Accessible name of the table (e.g. "Room listings"). */
  label: string;
  columns: WebTableColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row) => WebRowKey;
  /** loading → skeleton rows · error → error + retry (offline when the browser is offline) · forbidden → no permission. */
  status?: WebTableStatus;
  onRetry?: () => void;
  /** No rows while a search or filter is on: "No matches" + "Clear filters" instead of "Nothing here yet". */
  filtered?: boolean;
  onClearFilters?: () => void;
  /** Override the empty state (title / text / button) of this list. */
  empty?: { title?: string; description?: string; action?: React.ReactNode };
  sort?: WebSort | null;
  onSortChange?: (sort: WebSort) => void;
  /** Row checkboxes. The page keeps the selection (e.g. for bulk actions). */
  selectable?: boolean;
  selected?: ReadonlySet<WebRowKey>;
  onSelectionChange?: (next: Set<WebRowKey>) => void;
  /** Name read out by the row checkbox ("Select Room 1204"). */
  rowLabel?: (row: Row) => string;
  /** Click or Enter on a row. Buttons inside a cell should stop the event. */
  onRowPress?: (row: Row) => void;
  skeletonRows?: number;
  testID?: string;
}

/** Click on a header: a new column starts ascending, the same column flips. */
export function nextSort(current: WebSort | null | undefined, key: string): WebSort {
  if (current?.key === key) return { key, direction: current.direction === "asc" ? "desc" : "asc" };
  return { key, direction: "asc" };
}

/** Client-side sort for short lists (server lists send `sort` to the API instead). Stable; empty values go last. */
export function sortRows<Row>(rows: Row[], sort: WebSort | null | undefined, columns: WebTableColumn<Row>[]): Row[] {
  const column = sort ? columns.find((c) => c.key === sort.key) : undefined;
  if (!sort || !column?.sortValue) return rows;
  const value = column.sortValue;
  const factor = sort.direction === "asc" ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index, v: value(row) }))
    .sort((a, b) => {
      const aEmpty = a.v == null || a.v === "";
      const bEmpty = b.v == null || b.v === "";
      if (aEmpty || bEmpty) return aEmpty === bEmpty ? a.index - b.index : aEmpty ? 1 : -1;
      const diff =
        typeof a.v === "number" && typeof b.v === "number"
          ? a.v - b.v
          : String(a.v).localeCompare(String(b.v), undefined, { numeric: true, sensitivity: "base" });
      return diff === 0 ? a.index - b.index : diff * factor;
    })
    .map((item) => item.row);
}

function SelectAll({ checked, mixed, label, onChange }: { checked: boolean; mixed: boolean; label: string; onChange: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = mixed;
  }, [mixed]);
  return <input ref={ref} type="checkbox" className="awu-check" aria-label={label} checked={checked} aria-checked={mixed ? "mixed" : checked} onChange={onChange} />;
}

/**
 * Web table (plan step 3, A7). Sortable headers, optional row selection, and the shared states built in, so every
 * list page shows loading, empty, no-match, error, offline and no-permission the same way.
 */
export function WebTable<Row>(props: WebTableProps<Row>) {
  const { t } = useLocale();
  const { theme } = useMobileTheme();
  const online = useOnline();
  const copy = t.agent.dashboard.webStates;
  const status = props.status ?? "ready";
  const selected = props.selected ?? new Set<WebRowKey>();
  const keys = props.rows.map(props.rowKey);
  const selectedHere = keys.filter((key) => selected.has(key)).length;
  const allChecked = keys.length > 0 && selectedHere === keys.length;
  const selectable = !!props.selectable && !!props.onSelectionChange;
  const span = props.columns.length + (selectable ? 1 : 0);
  const align = (column: WebTableColumn<Row>) => (column.align && column.align !== "start" ? ` awu-align-${column.align}` : "");
  const hide = (column: WebTableColumn<Row>) => (column.hideBelow ? ` awu-hide-${column.hideBelow}` : "");

  const toggleAll = () => {
    const next = new Set(selected);
    if (allChecked) keys.forEach((key) => next.delete(key));
    else keys.forEach((key) => next.add(key));
    props.onSelectionChange?.(next);
  };
  const toggleRow = (key: WebRowKey) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    props.onSelectionChange?.(next);
  };

  let body: React.ReactNode;
  if (status === "loading") {
    body = (
      <tr>
        <td colSpan={span} className="awu-table-state">
          <WebSkeleton rows={props.skeletonRows ?? 5} columns={Math.min(props.columns.length, 5)} />
        </td>
      </tr>
    );
  } else if (status === "error" || status === "forbidden" || props.rows.length === 0) {
    const kind =
      status === "forbidden" ? "forbidden" : status === "error" ? (online ? "error" : "offline") : props.filtered ? "filtered" : "empty";
    body = (
      <tr>
        <td colSpan={span} className="awu-table-state">
          <WebState
            kind={kind}
            compact
            onRetry={props.onRetry}
            onClearFilters={props.onClearFilters}
            {...(kind === "empty" ? { title: props.empty?.title, description: props.empty?.description, action: props.empty?.action } : {})}
          />
        </td>
      </tr>
    );
  } else {
    body = props.rows.map((row) => {
      const key = props.rowKey(row);
      const isSelected = selected.has(key);
      const press = props.onRowPress;
      return (
        <tr
          key={key}
          className={`${press ? "awu-row-press" : ""}${isSelected ? " is-selected" : ""}`.trim() || undefined}
          aria-selected={selectable ? isSelected : undefined}
          tabIndex={press ? 0 : undefined}
          onClick={press ? () => press(row) : undefined}
          onKeyDown={
            press
              ? (event) => {
                  if (event.key === "Enter" && event.target === event.currentTarget) press(row);
                }
              : undefined
          }
          data-testid={props.testID ? `${props.testID}.row.${key}` : undefined}
        >
          {selectable ? (
            <td className="awu-cell-check" onClick={(event) => event.stopPropagation()}>
              <input
                type="checkbox"
                className="awu-check"
                checked={isSelected}
                aria-label={copy.selectRow.replace("{name}", props.rowLabel?.(row) ?? String(key))}
                onChange={() => toggleRow(key)}
              />
            </td>
          ) : null}
          {props.columns.map((column) => (
            <td key={column.key} className={`${align(column)}${hide(column)}`.trim() || undefined}>
              {column.cell(row)}
            </td>
          ))}
        </tr>
      );
    });
  }

  return (
    <div className="awu-table-wrap" data-testid={props.testID}>
      {selectable && selectedHere > 0 ? (
        <p className="awu-table-selected" role="status">
          {copy.selected.replace("{count}", String(selectedHere))}
        </p>
      ) : null}
      <table className="awu-table" aria-label={props.label} aria-busy={status === "loading" || undefined}>
        <thead>
          <tr>
            {selectable ? (
              <th scope="col" className="awu-cell-check">
                <SelectAll
                  checked={allChecked}
                  mixed={selectedHere > 0 && !allChecked}
                  label={copy.selectAll}
                  onChange={toggleAll}
                />
              </th>
            ) : null}
            {props.columns.map((column) => {
              const active = props.sort?.key === column.key ? props.sort.direction : null;
              const ariaSort = active === "asc" ? "ascending" : active === "desc" ? "descending" : column.sortable ? "none" : undefined;
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={ariaSort}
                  className={`${align(column)}${hide(column)}`.trim() || undefined}
                  style={column.width ? { width: column.width } : undefined}
                >
                  {column.sortable && props.onSortChange ? (
                    <button
                      type="button"
                      className="awu-sort"
                      aria-label={copy.sortBy.replace("{column}", column.header)}
                      onClick={() => props.onSortChange?.(nextSort(props.sort, column.key))}
                    >
                      <span>{column.header}</span>
                      <span className={`awu-sort-icon${active === "asc" ? " is-asc" : active ? "" : " is-off"}`} aria-hidden="true">
                        <MobileIcon name="chevron-down" size={12} color={active ? theme.screenTitle : theme.textSecondary} />
                      </span>
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>{body}</tbody>
      </table>
    </div>
  );
}
