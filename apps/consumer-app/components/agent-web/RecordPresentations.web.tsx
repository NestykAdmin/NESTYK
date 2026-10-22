import React, { useRef, useState } from "react";
import { useLocale } from "@nestyk/i18n";
import { MobileIcon } from "@nestyk/ui/native";
import type { AgentLead, LeadDisplayStatus } from "@nestyk/types";
import { tenantLease } from "../../lib/tenant-detail";
import {
  tenantListStatus,
  workCounts,
  TENANT_WORK_KINDS,
} from "../../lib/tenant-work";
import { leadDisplayStatus } from "../AgentLeadDetailBody";
import { leadMatchReady } from "../../lib/lead-match-preview";
import { LeadLocationPicker } from "../LeadLocationPicker";
import { validPriceRange } from "../room-price-range";
import type {
  RoomsPresentationProps,
  LeadsPresentationProps,
  TenantsPresentationProps,
} from "./RecordPresentations.types";
import "./agent-records.css";
import { AgentSelect } from "./AgentSelect";
import { useAgentListHeader } from "./AgentPageHeaderContext";

function useWords() {
  const { locale } = useLocale();
  return locale === "th"
    ? {
        search: "ค้นหา",
        results: "ผลการค้นหา",
        records: "รายการ",
        showing: "แสดง",
        of: "จาก",
        clear: "ล้างตัวกรอง",
        filters: "ตัวกรอง",
        details: "เปิดรายละเอียด",
        empty: "ไม่พบรายการ",
        emptyHint:
          "ลองเปลี่ยนคำค้นหาหรือล้างตัวกรอง หรือเพิ่มรายการใหม่จากปุ่มด้านบน",
        loading: "กำลังโหลดข้อมูล…",
        retry: "ลองอีกครั้ง",
        table: "ตาราง",
        grid: "การ์ด",
        property: "โครงการ / ห้อง",
        price: "ค่าเช่า / เดือน",
        contact: "ผู้ติดต่อ",
        status: "สถานะ",
        published: "การเผยแพร่",
        updated: "แก้ไขล่าสุด",
        action: "จัดการ",
        more: "โหลดเพิ่มเติม",
        lead: "ผู้สนใจ",
        budget: "งบประมาณ / เดือน",
        area: "ทำเลที่สนใจ",
        match: "ผลจับคู่ห้อง",
        viewing: "นัดดูห้องถัดไป",
        tenant: "ผู้เช่า",
        contract: "สัญญา / ค่าเช่า",
        end: "สิ้นสุดสัญญา",
        project: "ทุกโครงการ",
        all: "ทั้งหมด",
        apply: "ใช้ตัวกรอง",
        close: "ปิด",
        source: "แหล่งที่มา",
      }
    : {
        search: "Search",
        results: "Results",
        records: "records",
        showing: "Showing",
        of: "of",
        clear: "Clear filters",
        filters: "Filters",
        details: "View details",
        empty: "No records found",
        emptyHint:
          "Try another search, clear your filters, or add a new record using the button above.",
        loading: "Loading records…",
        retry: "Try again",
        table: "Table",
        grid: "Cards",
        property: "Property / room",
        price: "Rent / month",
        contact: "Contact",
        status: "Status",
        published: "Visibility",
        updated: "Last updated",
        action: "Actions",
        more: "Load more",
        lead: "Lead",
        budget: "Budget / month",
        area: "Preferred location",
        match: "Room matches",
        viewing: "Next viewing",
        tenant: "Tenant",
        contract: "Contract / rent",
        end: "Contract end",
        project: "All properties",
        all: "All",
        apply: "Apply filters",
        close: "Close",
        source: "Source",
      };
}
function Search({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="adr-search">
      <MobileIcon name="search" size={18} color="#8893a4" />
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="adr-select">
      <span className="adr-select-label">{label}</span>
      <AgentSelect
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </AgentSelect>
    </label>
  );
}
function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return <span className={`adr-pill adr-${tone}`}>{children}</span>;
}
function RecordState({
  loading,
  error,
  empty,
  onRetry,
}: {
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  onRetry?: () => void;
}) {
  const w = useWords();
  if (error)
    return (
      <div className="adr-state" role="alert">
        <MobileIcon name="warning" size={28} color="#b77525" />
        <strong>{error}</strong>
        {onRetry && (
          <button className="aw-button aw-button-secondary" onClick={onRetry}>
            {w.retry}
          </button>
        )}
      </div>
    );
  if (loading)
    return (
      <div className="adr-state" role="status">
        <span className="adr-spinner" />
        {w.loading}
      </div>
    );
  if (empty)
    return (
      <div className="adr-state">
        <span className="adr-empty-icon">
          <MobileIcon name="clipboard" size={26} color="#a1874b" />
        </span>
        <strong>{w.empty}</strong>
        <p>{w.emptyHint}</p>
      </div>
    );
  return null;
}
function Table({
  label,
  columns,
  children,
}: {
  label: string;
  columns: string[];
  children: React.ReactNode;
}) {
  return (
    <div
      className="adr-table-scroll"
      role="region"
      aria-label={label}
      tabIndex={0}
    >
      <table className="adr-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
function Avatar({ name }: { name: string }) {
  return (
    <span className="adr-avatar" aria-hidden="true">
      {name
        .trim()
        .split(/\s+/)
        .map((s) => s[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()}
    </span>
  );
}
function money(value: number | null | undefined, locale: string) {
  return value == null
    ? "—"
    : new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "THB",
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(value);
}
function date(value: string | null | undefined, locale: string, time = false) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        ...(time ? { timeStyle: "short" as const } : {}),
      }).format(d);
}
function Open({
  onClick,
  disabled = false,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  const w = useWords();
  return (
    <button className="adr-open" onClick={onClick} disabled={disabled}>
      {w.details}
      <MobileIcon name="chevron-right" size={15} color="#9c762e" />
    </button>
  );
}

export function RoomsPresentation(p: RoomsPresentationProps) {
  useAgentListHeader(
    "rooms",
    p.loading && !p.items.length ? undefined : p.total,
  );
  const { t, locale } = useLocale();
  const w = useWords();
  const c = t.agent.listings;
  const cr = t.agent.createRoom;
  const [view, setView] = useState<"table" | "grid">("table");
  const [expanded, setExpanded] = useState(false);
  const [price, setPrice] = useState({
    min: p.filters.minPrice,
    max: p.filters.maxPrice,
  });
  const set = (key: keyof typeof p.filters, value: string) => {
    const next = { ...p.filters, [key]: value };
    const beds: Record<string, string> = {
      studio: "0",
      one_bedroom: "1",
      one_bedroom_plus: "1",
      two_bedroom: "2",
      three_bedroom: "3",
      four_bedroom: "4",
    };
    if (key === "roomType" && beds[value] != null) next.bedrooms = beds[value];
    if (
      key === "bedrooms" &&
      beds[next.roomType] != null &&
      value &&
      beds[next.roomType] !== value
    )
      next.roomType = "";
    p.onFiltersChange(next);
  };
  const clear = () => {
    setPrice({ min: "", max: "" });
    p.onFiltersChange({
      visibility: "",
      roomStatus: "",
      listingSource: "",
      propertyType: "",
      roomType: "",
      bedrooms: "",
      minPrice: "",
      maxPrice: "",
    });
  };
  const filtered = Object.values(p.filters).some(Boolean);
  const roomPrice = (item: RoomsPresentationProps["items"][number]) =>
    item.prices.length ? Math.min(...item.prices.map((r) => r.price)) : null;
  const tone = (status: string | null) =>
    status === "available"
      ? "success"
      : status === "rented"
        ? "info"
        : status === "needs_edit"
          ? "danger"
          : status === "pending_verification"
            ? "warning"
            : "neutral";
  const priceValid = validPriceRange({
    minPrice: price.min,
    maxPrice: price.max,
  });
  return (
    <section className="adr-page" data-testid="agent-web-rooms">
      <div className="adr-toolbar">
        <Search
          value={p.query}
          onChange={p.onQueryChange}
          placeholder={c.searchRooms}
        />
        <button
          className={`aw-button aw-button-secondary ${expanded ? "adr-selected" : ""}`}
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          <MobileIcon name="sliders" size={17} color="#8f743b" />
          {w.filters}
          {filtered && (
            <span className="adr-count">
              {Object.values(p.filters).filter(Boolean).length}
            </span>
          )}
        </button>
        <Select
          label={c.sortTitle}
          value={p.sort}
          options={p.sortOptions}
          onChange={(v) => p.onSortChange(v as typeof p.sort)}
        />
      </div>
      <div className="adr-filter-row">
        <Select
          label={w.status}
          value={p.filters.roomStatus}
          options={p.statusOptions}
          onChange={(v) => set("roomStatus", v)}
        />
        <Select
          label={w.published}
          value={p.filters.visibility}
          options={p.visibilityOptions}
          onChange={(v) => set("visibility", v)}
        />
        <Select
          label={w.source}
          value={p.filters.listingSource}
          options={[
            { value: "", label: w.all },
            { value: "owner", label: cr.sourceOwner },
            { value: "co_agent", label: cr.sourceCoAgent },
          ]}
          onChange={(v) => set("listingSource", v)}
        />
        {filtered && (
          <button className="adr-link" onClick={clear}>
            {w.clear}
          </button>
        )}
      </div>
      {expanded && (
        <div className="adr-filter-panel">
          <Select
            label={cr.propertyType}
            value={p.filters.propertyType}
            options={[
              { value: "", label: w.all },
              ...Object.entries(t.masters.propertyTypes).map(
                ([value, label]) => ({ value, label }),
              ),
            ]}
            onChange={(v) => set("propertyType", v)}
          />
          <Select
            label={cr.roomType}
            value={p.filters.roomType}
            options={[
              { value: "", label: w.all },
              ...Object.entries(t.masters.roomTypes).map(([value, label]) => ({
                value,
                label,
              })),
            ]}
            onChange={(v) => set("roomType", v)}
          />
          <Select
            label={cr.bedroom}
            value={p.filters.bedrooms}
            options={[
              { value: "", label: w.all },
              ...["0", "1", "2", "3", "4"].map((value) => ({
                value,
                label:
                  value === "0"
                    ? t.masters.roomTypes.studio
                    : value === "4"
                      ? "4+"
                      : value,
              })),
            ]}
            onChange={(v) => set("bedrooms", v)}
          />
          <div className="adr-price">
            <label>
              {w.price}
              <div>
                <input
                  aria-label={c.filterMinPrice}
                  inputMode="decimal"
                  placeholder="0"
                  value={price.min}
                  onChange={(e) =>
                    setPrice((s) => ({ ...s, min: e.target.value }))
                  }
                />
                <span>—</span>
                <input
                  aria-label={c.filterMaxPrice}
                  inputMode="decimal"
                  placeholder="∞"
                  value={price.max}
                  onChange={(e) =>
                    setPrice((s) => ({ ...s, max: e.target.value }))
                  }
                />
              </div>
            </label>
            <button
              className="aw-button aw-button-secondary"
              disabled={!priceValid}
              onClick={() =>
                p.onFiltersChange({
                  ...p.filters,
                  minPrice: price.min,
                  maxPrice: price.max,
                })
              }
            >
              {w.apply}
            </button>
            {!priceValid && (
              <small role="alert">{t.agent.leads.budgetError}</small>
            )}
          </div>
        </div>
      )}
      <div className="adr-panel">
        <div className="adr-panel-head">
          <div>
            <strong>{w.results}</strong>
            <span className="adr-count">{p.total}</span>
          </div>
          <div className="adr-view-toggle">
            {(["table", "grid"] as const).map((v) => (
              <button
                key={v}
                aria-pressed={view === v}
                onClick={() => setView(v)}
              >
                <MobileIcon
                  name={v === "table" ? "list-rows" : "grid"}
                  size={16}
                  color="currentColor"
                />
                {w[v]}
              </button>
            ))}
          </div>
        </div>
        {p.error && p.items.length > 0 && (
          <div className="adr-notice" role="alert">
            {p.error}
            <button onClick={p.onRetry}>{w.retry}</button>
          </div>
        )}
        <RecordState
          loading={p.loading && !p.items.length}
          error={!p.items.length ? p.error : null}
          empty={!p.loading && !p.error && !p.items.length}
          onRetry={p.onRetry}
        />
        {p.items.length > 0 &&
          (view === "table" ? (
            <Table
              label={t.mobile.tabs.listingRoom}
              columns={[
                w.property,
                w.price,
                w.status,
                w.published,
                w.contact,
                w.action,
              ]}
            >
              {p.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <button
                      className="adr-person"
                      onClick={() => p.onOpen(item.id)}
                    >
                      {item.coverMediaUrl ? (
                        <img
                          className="adr-cover"
                          src={item.coverMediaUrl}
                          alt=""
                        />
                      ) : (
                        <span className="adr-cover adr-placeholder">
                          <MobileIcon
                            name="buildings"
                            size={23}
                            color="#97a1b2"
                          />
                        </span>
                      )}
                      <span>
                        <strong>
                          {item.property?.name ||
                            item.listingTitle ||
                            `#${item.id}`}
                        </strong>
                        <small>
                          {[
                            item.listingTitle,
                            item.property?.district,
                            item.roomSizeSqm ? `${item.roomSizeSqm} m²` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </small>
                      </span>
                    </button>
                  </td>
                  <td className="adr-money">
                    {money(roomPrice(item), locale)}
                  </td>
                  <td>
                    <Pill tone={tone(item.roomStatusCode)}>
                      {String(
                        c[item.roomStatusCode as keyof typeof c] ||
                          item.roomStatusCode ||
                          "—",
                      )}
                    </Pill>
                  </td>
                  <td>
                    <Pill
                      tone={
                        item.visibility === "published" ? "success" : "neutral"
                      }
                    >
                      {item.visibility === "published"
                        ? cr.visibilityPublished
                        : cr.visibilityPrivate}
                    </Pill>
                  </td>
                  <td>
                    <strong>
                      {item.contact?.name || item.propertyOwner?.name || "—"}
                    </strong>
                    <small>
                      {item.contact?.phone || item.propertyOwner?.phone}
                    </small>
                  </td>
                  <td>
                    <Open onClick={() => p.onOpen(item.id)} />
                  </td>
                </tr>
              ))}
            </Table>
          ) : (
            <div className="adr-room-grid">
              {p.items.map((item) => (
                <button
                  className="adr-room-card"
                  key={item.id}
                  onClick={() => p.onOpen(item.id)}
                >
                  {item.coverMediaUrl ? (
                    <img src={item.coverMediaUrl} alt="" />
                  ) : (
                    <span className="adr-room-photo">
                      <MobileIcon name="buildings" size={38} color="#a1aaba" />
                    </span>
                  )}
                  <span className="adr-room-card-body">
                    <Pill tone={tone(item.roomStatusCode)}>
                      {String(
                        c[item.roomStatusCode as keyof typeof c] ||
                          item.roomStatusCode ||
                          "—",
                      )}
                    </Pill>
                    <strong>
                      {item.property?.name ||
                        item.listingTitle ||
                        `#${item.id}`}
                    </strong>
                    <small>
                      {item.listingTitle || item.property?.district}
                    </small>
                    <b>{money(roomPrice(item), locale)}</b>
                  </span>
                </button>
              ))}
            </div>
          ))}
        <div className="adr-panel-footer">
          <span>
            {w.showing} {p.items.length} {w.of} {p.total} {w.records}
          </span>
          {p.moreError ? (
            <button className="adr-link" onClick={p.onRetryMore}>
              {w.retry}
            </button>
          ) : (
            p.hasMore && (
              <button
                className="aw-button aw-button-secondary"
                disabled={p.loadingMore}
                onClick={p.onLoadMore}
              >
                {p.loadingMore ? w.loading : w.more}
              </button>
            )
          )}
        </div>
        {p.moreError && (
          <p className="adr-notice" role="alert">
            {p.moreError}
          </p>
        )}
      </div>
    </section>
  );
}

export function LeadsPresentation(p: LeadsPresentationProps) {
  useAgentListHeader(
    "leads",
    p.loading && !p.items.length ? undefined : p.total,
  );
  const { t, locale } = useLocale();
  const w = useWords();
  const c = t.agent.leads;
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState(p.location);
  const statuses: Array<LeadDisplayStatus | null> = [
    null,
    "new",
    "inprogress",
    "viewing",
    "booked",
    "lost",
  ];
  const locationActive =
    !!p.location.province ||
    p.location.locations.length > 0 ||
    p.location.includeUnspecified;
  const budget = (lead: AgentLead) =>
    lead.budgetMin != null && lead.budgetMax != null
      ? `${money(lead.budgetMin, locale)} – ${money(lead.budgetMax, locale)}`
      : money(lead.budgetMax ?? lead.budgetMin, locale);
  return (
    <section className="adr-page" data-testid="agent-web-leads">
      {p.workFilter && (
        <div className="adr-notice">
          {t.agent.dashboard.filterActive.replace(
            "{label}",
            t.agent.dashboard.leadsFollowUp,
          )}
          <button onClick={p.onClearWorkFilter}>
            {t.agent.dashboard.clearFilter}
          </button>
        </div>
      )}
      <div className="adr-status-tabs" aria-label={c.statusFilter}>
        {statuses.map((status) => (
          <button
            key={status ?? "all"}
            aria-pressed={p.status === status}
            onClick={() => p.onStatusChange(status)}
          >
            {status ? c.statuses[status] : c.statusAll}
            <span>
              {p.statusCounts
                ? status
                  ? p.statusCounts[status]
                  : Object.values(p.statusCounts).reduce((a, b) => a + b, 0)
                : "—"}
            </span>
          </button>
        ))}
      </div>
      <div className="adr-toolbar">
        <Search
          value={p.query}
          onChange={p.onQueryChange}
          placeholder={c.search}
        />
        <button
          className={`aw-button aw-button-secondary ${locationActive ? "adr-selected" : ""}`}
          onClick={() => {
            setDraft(p.location);
            dialog.current?.showModal();
          }}
        >
          <MobileIcon name="map-pin" size={17} color="#8f743b" />
          {c.searchFilters}
        </button>
        <Select
          label={c.sortTitle}
          value={p.sort}
          options={p.sortOptions}
          onChange={(v) => p.onSortChange(v as typeof p.sort)}
        />
      </div>
      {locationActive && (
        <div className="adr-active-filters">
          <span>
            {[
              p.location.province,
              ...p.location.locations,
              p.location.includeUnspecified ? c.includeUnspecified : "",
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
          <button
            className="adr-link"
            onClick={() =>
              p.onLocationChange({
                province: "",
                locations: [],
                includeUnspecified: false,
              })
            }
          >
            {w.clear}
          </button>
        </div>
      )}
      <div className="adr-panel">
        <div className="adr-panel-head">
          <div>
            <strong>{p.status ? c.statuses[p.status] : c.statusAll}</strong>
            <span className="adr-count">{p.total}</span>
          </div>
          <span className="adr-muted">
            {w.showing} {p.items.length} {w.records}
          </span>
        </div>
        {p.error && p.items.length > 0 && (
          <div className="adr-notice" role="alert">
            {p.error}
            <button onClick={p.onRetry}>{w.retry}</button>
          </div>
        )}
        <RecordState
          loading={p.loading && !p.items.length}
          error={!p.items.length ? p.error : null}
          empty={!p.loading && !p.error && !p.items.length}
          onRetry={p.onRetry}
        />
        {p.items.length > 0 && (
          <Table
            label={t.mobile.tabs.listingLead}
            columns={[
              w.lead,
              w.budget,
              w.area,
              w.status,
              w.match,
              w.viewing,
              w.action,
            ]}
          >
            {p.items.map((lead) => {
              const status = leadDisplayStatus(lead) as LeadDisplayStatus;
              const match = lead.lastMatch;
              return (
                <tr key={lead.id}>
                  <td>
                    <button
                      className="adr-person"
                      onClick={() => p.onOpen(lead)}
                    >
                      <Avatar name={lead.name} />
                      <span>
                        <strong>{lead.name}</strong>
                        <small>{lead.phone}</small>
                      </span>
                    </button>
                  </td>
                  <td className="adr-money">{budget(lead)}</td>
                  <td>
                    <span className="adr-area">
                      {lead.pins[0]?.name ||
                        lead.province ||
                        lead.preferredLocation ||
                        "—"}
                    </span>
                    <small>
                      {lead.desiredRoomTypeCode
                        ? t.masters.roomTypes[
                            lead.desiredRoomTypeCode as keyof typeof t.masters.roomTypes
                          ] || lead.desiredRoomTypeCode
                        : "—"}
                    </small>
                  </td>
                  <td>
                    <Pill
                      tone={
                        status === "booked"
                          ? "success"
                          : status === "lost"
                            ? "neutral"
                            : status === "viewing"
                              ? "warning"
                              : "info"
                      }
                    >
                      {c.statuses[status]}
                    </Pill>
                  </td>
                  <td>
                    {match ? (
                      <>
                        <strong>
                          {c.matchRooms.replace(
                            "{count}",
                            String(match.resultCount),
                          )}
                        </strong>
                        <small>
                          {match.stale
                            ? c.matchStale
                            : match.topScore == null
                              ? "—"
                              : `${match.topScore}%`}
                        </small>
                      </>
                    ) : (
                      <small>
                        {leadMatchReady(lead)
                          ? c.matchNotRun
                          : c.matchNeedsInfo}
                      </small>
                    )}
                  </td>
                  <td>
                    {date(lead.nextViewingAt, locale, true)}
                    <small>{lead.nextViewingRoom}</small>
                  </td>
                  <td>
                    <Open onClick={() => p.onOpen(lead)} />
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
        <div className="adr-panel-footer">
          <span>
            {w.showing} {p.total ? (p.page - 1) * 20 + 1 : 0}–
            {Math.min(p.page * 20, p.total)} {w.of} {p.total}
          </span>
          <div className="adr-pagination">
            <button
              disabled={p.page <= 1 || p.loading}
              onClick={() => p.onPageChange(p.page - 1)}
            >
              {c.previous}
            </button>
            <span>
              {p.page} / {Math.max(1, Math.ceil(p.total / 20))}
            </span>
            <button
              disabled={p.page * 20 >= p.total || p.loading}
              onClick={() => p.onPageChange(p.page + 1)}
            >
              {c.next}
            </button>
          </div>
        </div>
      </div>
      <dialog
        ref={dialog}
        className="adr-dialog"
        aria-label={c.searchFilters}
        onClick={(e) => {
          if (e.target === e.currentTarget) dialog.current?.close();
        }}
      >
        <div className="adr-dialog-head">
          <h2>{c.searchFilters}</h2>
          <button
            className="aw-icon-button"
            aria-label={w.close}
            onClick={() => dialog.current?.close()}
          >
            <MobileIcon name="close" size={20} color="currentColor" />
          </button>
        </div>
        <div className="adr-dialog-body">
          <LeadLocationPicker
            filter
            province={draft.province}
            locations={draft.locations}
            onChange={(province, locations) =>
              setDraft((s) => ({
                ...s,
                province,
                locations,
                includeUnspecified:
                  locations.length > 0 && s.includeUnspecified,
              }))
            }
          />
          {draft.locations.length > 0 && (
            <label className="adr-checkbox">
              <input
                type="checkbox"
                checked={draft.includeUnspecified}
                onChange={(e) =>
                  setDraft((s) => ({
                    ...s,
                    includeUnspecified: e.target.checked,
                  }))
                }
              />
              {c.includeUnspecified}
            </label>
          )}
        </div>
        <div className="adr-dialog-footer">
          <button
            className="adr-link"
            onClick={() =>
              setDraft({
                province: "",
                locations: [],
                includeUnspecified: false,
              })
            }
          >
            {w.clear}
          </button>
          <button
            className="aw-button aw-button-primary"
            onClick={() => {
              p.onLocationChange(draft);
              dialog.current?.close();
            }}
          >
            {w.apply}
          </button>
        </div>
      </dialog>
    </section>
  );
}

export function TenantsPresentation(p: TenantsPresentationProps) {
  const { t, locale } = useLocale();
  const w = useWords();
  const c = t.agent.tenants;
  const l = c.list;
  const counts = workCounts(p.workItems);
  const [project, setProject] = useState("");
  const projects = Array.from(
    new Set(p.tenants.map((t) => t.property).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, locale));
  const matches = (
    tenant: TenantsPresentationProps["tenants"][number],
    filter: typeof p.filter,
  ) =>
    filter === "all" ||
    (filter === "active") === (tenantLease(tenant)?.status === "active");
  const visible = p.tenants.filter(
    (tenant) =>
      matches(tenant, p.filter) &&
      (!project || tenant.property === project) &&
      `${tenant.name} ${tenant.phone} ${tenant.property} ${tenant.room ?? ""} ${tenant.contracts.map((x) => `${x.property} ${x.room ?? ""} ${x.contractNo}`).join(" ")}`
        .toLocaleLowerCase(locale)
        .includes(p.query.trim().toLocaleLowerCase(locale)),
  );
  const work = p.workItems.filter(
    (item) =>
      (!p.kind || p.kind === item.kind) &&
      `${item.tenant.name} ${item.tenant.property} ${item.tenant.room ?? ""}`
        .toLocaleLowerCase(locale)
        .includes(p.workQuery.trim().toLocaleLowerCase(locale)),
  );
  useAgentListHeader(
    p.view === "all" ? "tenants" : "tenantWork",
    p.loading ? undefined : p.view === "all" ? visible.length : work.length,
  );
  const labels = {
    slip: l.tileSlip,
    overdue: l.tileOverdue,
    signing: l.tileSigning,
    renewal: l.tileRenewal,
  };
  const pill = (tenant: TenantsPresentationProps["tenants"][number]) => {
    const status = tenantListStatus(tenant, p.workItems);
    return {
      label:
        status === "slip"
          ? l.pillSlip
          : status === "signing"
            ? l.tileSigning
            : status === "renewal"
              ? l.tileRenewal
              : status === "active"
                ? l.pillActive
                : l.pillSigningContract,
      tone:
        status === "active"
          ? "success"
          : status === "slip"
            ? "warning"
            : status === "renewal"
              ? "warning"
              : "info",
    };
  };
  return (
    <section className="adr-page" data-testid="agent-web-tenants">
      <div className="adr-status-tabs">
        <button
          aria-pressed={p.view === "all"}
          onClick={() => p.onViewChange("all")}
        >
          {l.tabAll}
          <span>{p.tenants.length}</span>
        </button>
        <button
          aria-pressed={p.view === "work"}
          onClick={() => p.onViewChange("work")}
        >
          {l.tabWork}
          <span>{p.workItems.length}</span>
        </button>
      </div>
      {p.view === "work" ? (
        <>
          <div className="adr-work-stats">
            {TENANT_WORK_KINDS.map((kind) => (
              <button
                key={kind}
                aria-pressed={p.kind === kind}
                disabled={kind === "overdue"}
                onClick={() => p.onKindChange(p.kind === kind ? null : kind)}
              >
                <span>{labels[kind]}</span>
                <strong>{counts[kind]}</strong>
                <small>
                  {kind === "overdue"
                    ? l.tileOverdueHint
                    : kind === "slip"
                      ? l.tileSlipHint
                      : kind === "renewal"
                        ? l.tileRenewal
                        : l.tileSigning}
                </small>
              </button>
            ))}
          </div>
          <div className="adr-toolbar">
            <Search
              value={p.workQuery}
              onChange={p.onWorkQueryChange}
              placeholder={l.searchAll}
            />
            {p.kind && (
              <button className="adr-link" onClick={() => p.onKindChange(null)}>
                {w.clear}
              </button>
            )}
          </div>
        </>
      ) : (
        <div className="adr-toolbar">
          <Search
            value={p.query}
            onChange={p.onQueryChange}
            placeholder={l.searchAll}
          />
          <Select
            label={w.status}
            value={p.filter}
            options={[
              { value: "all", label: l.filterAll },
              { value: "signing", label: l.filterSigning },
              { value: "active", label: l.filterActive },
            ]}
            onChange={(v) => p.onFilterChange(v as typeof p.filter)}
          />
          <Select
            label={w.property}
            value={project}
            options={[
              { value: "", label: w.project },
              ...projects.map((value) => ({ value, label: value })),
            ]}
            onChange={setProject}
          />
        </div>
      )}
      {p.error && (
        <div className="adr-notice" role="alert">
          {p.error}
        </div>
      )}
      <div className="adr-panel">
        <div className="adr-panel-head">
          <div>
            <strong>{p.view === "all" ? l.tabAll : l.workTitle}</strong>
            <span className="adr-count">
              {p.view === "all" ? visible.length : work.length}
            </span>
          </div>
          {p.busy && <span role="status">{w.loading}</span>}
        </div>
        <RecordState
          loading={p.loading}
          empty={
            !p.loading &&
            !p.error &&
            (p.view === "all" ? !visible.length : !work.length)
          }
        />
        {!p.loading &&
          (p.view === "all"
            ? visible.length > 0 && (
                <Table
                  label={l.tabAll}
                  columns={[
                    w.tenant,
                    w.property,
                    w.contract,
                    w.status,
                    w.end,
                    w.action,
                  ]}
                >
                  {visible.map((tenant) => {
                    const lease = tenantLease(tenant);
                    const status = pill(tenant);
                    return (
                      <tr key={tenant.id}>
                        <td>
                          <button
                            className="adr-person"
                            disabled={p.busy}
                            onClick={() => p.onOpen(tenant)}
                          >
                            <Avatar name={tenant.name} />
                            <span>
                              <strong>{tenant.name}</strong>
                              <small>{tenant.phone}</small>
                            </span>
                          </button>
                        </td>
                        <td>
                          <strong>{tenant.property || l.noProject}</strong>
                          <small>
                            {tenant.room
                              ? l.metaRoom.replace("{room}", tenant.room)
                              : "—"}
                          </small>
                        </td>
                        <td>
                          <strong className="adr-money">
                            {money(lease?.monthlyRent, locale)}
                          </strong>
                          <small>{lease?.contractNo || "—"}</small>
                        </td>
                        <td>
                          <Pill tone={status.tone}>{status.label}</Pill>
                        </td>
                        <td>{date(lease?.endDate, locale)}</td>
                        <td>
                          <Open
                            disabled={p.busy}
                            onClick={() => p.onOpen(tenant)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </Table>
              )
            : work.length > 0 && (
                <Table
                  label={l.workTitle}
                  columns={[
                    w.tenant,
                    w.property,
                    w.status,
                    w.contract,
                    w.action,
                  ]}
                >
                  {work.map((item) => (
                    <tr
                      key={`${item.kind}-${item.tenant.id}-${"contract" in item ? item.contract.id : "bill" in item ? item.bill.id : 0}`}
                    >
                      <td>
                        <button
                          className="adr-person"
                          disabled={p.busy}
                          onClick={() => p.onWorkOpen(item)}
                        >
                          <Avatar name={item.tenant.name} />
                          <span>
                            <strong>{item.tenant.name}</strong>
                            <small>{item.tenant.phone}</small>
                          </span>
                        </button>
                      </td>
                      <td>
                        <strong>{item.tenant.property || l.noProject}</strong>
                        <small>{item.tenant.room}</small>
                      </td>
                      <td>
                        <Pill
                          tone={
                            item.kind === "slip"
                              ? "warning"
                              : item.kind === "renewal"
                                ? "warning"
                                : "info"
                          }
                        >
                          {labels[item.kind]}
                        </Pill>
                      </td>
                      <td>
                        {item.kind === "slip"
                          ? money(item.bill.amount, locale)
                          : item.kind === "signing"
                            ? `${item.signed} / ${item.required}`
                            : item.kind === "renewal"
                              ? l.pillRenewal.replace(
                                  "{days}",
                                  String(item.daysLeft),
                                )
                              : "—"}
                      </td>
                      <td>
                        <button
                          className="adr-open"
                          disabled={p.busy}
                          onClick={() => p.onWorkAction(item)}
                        >
                          {item.kind === "slip"
                            ? l.ctaSlip
                            : item.kind === "signing"
                              ? l.ctaSigning
                              : l.ctaRenewal}
                          <MobileIcon
                            name="chevron-right"
                            size={15}
                            color="#9c762e"
                          />
                        </button>
                      </td>
                    </tr>
                  ))}
                </Table>
              ))}
        <div className="adr-panel-footer">
          <span>
            {w.showing} {p.view === "all" ? visible.length : work.length} {w.of}{" "}
            {p.view === "all" ? p.tenants.length : p.workItems.length}{" "}
            {w.records}
          </span>
          <span className="adr-muted">
            {p.view === "all" ? l.subtitleAll : l.workSort}
          </span>
        </div>
      </div>
    </section>
  );
}
