import React, { useEffect, useMemo, useRef, useState } from "react";
import type { AgentLead, AgentLeadsPage as AgentLeadsResult, AgentLeadsSort, LeadDisplayStatus } from "@nestyk/types";
import { MobileFilterChip, MobileIcon, useMobileTheme } from "@nestyk/ui/native";
import { localizedError, useLocale } from "@nestyk/i18n";
import { listAgentLeads } from "../../lib/agent-leads-api";
import { leadMatchReady } from "../../lib/lead-match-preview";
import { pageButtons, pageRange } from "../../lib/agent-room-filters";
import { LeadLocationPicker } from "../LeadLocationPicker";
import { LeadNewBadge, LeadStatusBadge, leadAvatarInitials, leadDisplayStatus, leadStatusTone } from "../AgentLeadDetailBody";
import { AgentSelect } from "./AgentSelect";
import { WebDialog, WebTable, type WebTableColumn } from "./ui";
import type { AgentLeadsPageProps } from "./AgentLeadsPage.types";
import "./agent-rooms.css";
import "./agent-leads.css";

/** The leads API pages by 20 (lib/agent-leads-api.ts). */
const PAGE_SIZE = 20;
const STATUS_CHIPS: Array<LeadDisplayStatus | null> = [null, "new", "inprogress", "viewing", "booked", "lost"];

type LocationFilter = { province: string; locations: string[]; includeUnspecified: boolean };
const NO_LOCATION: LocationFilter = { province: "", locations: [], includeUnspecified: false };

type Memory = {
  query: string;
  sort: AgentLeadsSort;
  status: LeadDisplayStatus | null;
  page: number;
  location: LocationFilter;
};
/** The shell remounts the page when a lead opens; the list comes back with the same search, filters and page (as the app). */
let memory: Memory | null = null;

/**
 * Agent web leads (W2, Mos 5 Nov 2026): a table instead of the phone list. Same API, status chips with counts,
 * area filter, sorts and status badges as `AgentLeadsScreen`; a row opens the same lead detail. The phone screen is untouched.
 */
export function AgentLeadsPage({ workFilter = null, reloadToken, onReloadSettled, onOpenLead, onAddLead }: AgentLeadsPageProps) {
  const { t, locale } = useLocale();
  const { theme } = useMobileTheme();
  const c = t.agent.leads;
  const web = c.web;
  const pager = t.agent.listings.web;
  const dash = t.agent.dashboard;
  const localeTag = locale === "th" ? "th-TH-u-ca-gregory" : locale;

  const [query, setQuery] = useState(memory?.query ?? "");
  const [search, setSearch] = useState((memory?.query ?? "").trim());
  const [sort, setSort] = useState<AgentLeadsSort>(memory?.sort ?? "updated_desc");
  const [status, setStatus] = useState<LeadDisplayStatus | null>(memory?.status ?? null);
  const [page, setPage] = useState(memory?.page ?? 1);
  const [location, setLocation] = useState<LocationFilter>(memory?.location ?? NO_LOCATION);
  const [draft, setDraft] = useState<LocationFilter>(NO_LOCATION);
  const [filterOpen, setFilterOpen] = useState(false);
  const [activeWorkFilter, setActiveWorkFilter] = useState(workFilter);
  const [items, setItems] = useState<AgentLead[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<AgentLeadsResult["statusCounts"] | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const loadedOnce = useRef(false);

  useEffect(() => {
    memory = { query, sort, status, page, location };
  }, [query, sort, status, page, location]);

  useEffect(() => setActiveWorkFilter(workFilter), [workFilter]);

  // Search waits for a short pause in typing, then starts again from page 1.
  useEffect(() => {
    const next = query.trim();
    if (next === search) return;
    const timer = setTimeout(() => {
      setSearch(next);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [query, search]);

  useEffect(() => {
    let cancelled = false;
    if (loadedOnce.current) setBusy(true);
    else setState("loading");
    listAgentLeads(search, page, {
      province: location.province,
      locations: location.locations,
      includeUnspecified: location.includeUnspecified,
      sort,
      status: status ?? undefined,
    })
      .then((result) => {
        if (cancelled) return;
        // A page that emptied meanwhile: go back to the last page that has rows (same as the app).
        if (page > 1 && !result.items.length && result.total > 0) {
          setPage(Math.max(1, Math.ceil(result.total / PAGE_SIZE)));
          return;
        }
        loadedOnce.current = true;
        setItems(result.items);
        setTotal(result.total);
        setCounts(result.statusCounts ?? null);
        setErrorText(null);
        setState("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorText(localizedError(err, t.common.errorGeneric, locale));
        setState("error");
      })
      .finally(() => {
        if (cancelled) return;
        setBusy(false);
        if (reloadToken) onReloadSettled?.(reloadToken);
      });
    return () => {
      cancelled = true;
    };
    // t / locale only change the error text; they must not refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, page, sort, status, location, refresh, reloadToken]);

  const sortOptions: Array<{ value: AgentLeadsSort; label: string }> = [
    { value: "updated_desc", label: c.sortUpdatedDesc },
    { value: "created_desc", label: c.sortCreatedDesc },
    { value: "created_asc", label: c.sortCreatedAsc },
    { value: "name_asc", label: c.sortNameAsc },
    { value: "budget_asc", label: c.sortBudgetAsc },
    { value: "budget_desc", label: c.sortBudgetDesc },
    { value: "status_asc", label: c.sortStatusAsc },
    { value: "status_desc", label: c.sortStatusDesc },
  ];

  const chips = useMemo(() => {
    const list: Array<{ key: string; label: string; next: LocationFilter }> = [];
    if (location.province) list.push({ key: "province", label: location.province, next: NO_LOCATION });
    for (const area of location.locations) {
      const rest = location.locations.filter((item) => item !== area);
      list.push({
        key: `area:${area}`,
        label: area,
        next: { ...location, locations: rest, includeUnspecified: rest.length > 0 && location.includeUnspecified },
      });
    }
    if (location.includeUnspecified)
      list.push({ key: "unspecified", label: c.includeUnspecified, next: { ...location, includeUnspecified: false } });
    return list;
  }, [location, c.includeUnspecified]);

  const applyLocation = (next: LocationFilter) => {
    setLocation(next);
    setPage(1);
  };
  const clearAll = () => {
    setQuery("");
    setSearch("");
    setStatus(null);
    applyLocation(NO_LOCATION);
  };
  const goToPage = (next: number) => {
    setPage(next);
    rootRef.current?.closest(".aw-page-scroll")?.scrollTo({ top: 0 });
  };

  const filtered = !!search || !!status || chips.length > 0;
  const range = pageRange(page, PAGE_SIZE, total);

  // Same wording as the app list (AgentLeadsScreen).
  const budget = (lead: AgentLead) => {
    if (lead.budgetMin == null && lead.budgetMax == null) return null;
    const amounts = [lead.budgetMin, lead.budgetMax]
      .filter((n): n is number => n != null)
      .map((n) => n.toLocaleString(localeTag))
      .join(" – ");
    return `${amounts} ${t.agent.listings.rentPerMonth.replace("{price}", "").trim()}`.trim();
  };
  const roomType = (lead: AgentLead) =>
    lead.desiredRoomTypeCode
      ? t.masters.roomTypes[lead.desiredRoomTypeCode as keyof typeof t.masters.roomTypes] || lead.desiredRoomTypeCode
      : null;
  const place = (lead: AgentLead) =>
    lead.pins[0]?.name || lead.province || (lead.locations?.length ? lead.locations[0] : null) || lead.preferredLocation || null;
  const day = (iso: string | null | undefined) => {
    const date = iso ? new Date(iso) : null;
    return date && !Number.isNaN(date.getTime())
      ? new Intl.DateTimeFormat(localeTag, { day: "numeric", month: "short", year: "numeric" }).format(date)
      : "—";
  };

  const matchCell = (lead: AgentLead) => {
    const match = lead.lastMatch ?? null;
    if (match && match.resultCount > 0)
      return (
        <span className="awl-match" aria-label={c.matchScoreA11y.replace("{score}", String(match.topScore ?? 0))}>
          <strong>{`${match.topScore ?? 0}%`}</strong>
          <small>{c.matchRooms.replace("{count}", String(match.resultCount))}</small>
        </span>
      );
    if (match) return <span className="awl-match-none">{c.matchNone}</span>;
    if (!leadMatchReady(lead))
      return (
        <span className="awl-match-warn">
          <MobileIcon name="warning" size={14} color="currentColor" />
          {c.matchNeedsInfo}
        </span>
      );
    return <span className="awr-muted">{c.matchNotRun}</span>;
  };

  const columns: WebTableColumn<AgentLead>[] = [
    {
      key: "lead",
      header: web.colLead,
      cell: (lead) => {
        return (
          <span className="awl-lead">
            <span className="awl-avatar" aria-hidden="true">
              {leadAvatarInitials(lead.name)}
            </span>
            <span className="awr-room">
              <strong>{lead.name}</strong>
              {lead.phone ? <small>{lead.phone}</small> : null}
            </span>
          </span>
        );
      },
    },
    {
      key: "area",
      header: web.colArea,
      // The area is on the lead page too; under 1280px the table keeps lead, budget, status and match.
      hideBelow: "lg",
      cell: (lead) => (
        <span className="awr-room">
          <span>{place(lead) ?? "—"}</span>
          {roomType(lead) ? <small>{roomType(lead)}</small> : null}
        </span>
      ),
    },
    { key: "budget", header: web.colBudget, cell: (lead) => <span className="awr-nowrap">{budget(lead) ?? "—"}</span> },
    {
      key: "status",
      header: web.colStatus,
      cell: (lead) => {
        const shown = leadDisplayStatus(lead);
        return (
          <span className="awl-status">
            <span className="awl-badges">
              <LeadStatusBadge status={shown} />
              <LeadNewBadge lead={lead} />
            </span>
            {shown === "viewing" && lead.nextViewingAt ? (
              <small>
                {[day(lead.nextViewingAt), lead.nextViewingRoom].filter(Boolean).join(" · ")}
              </small>
            ) : null}
          </span>
        );
      },
    },
    { key: "match", header: web.colMatch, hideBelow: "md", cell: matchCell },
    { key: "updated", header: web.colUpdated, hideBelow: "lg", cell: (lead) => <span className="awr-muted">{day(lead.updatedAt ?? lead.createdAt)}</span> },
  ];

  return (
    <div className="awr-page" ref={rootRef} data-testid="leads.page">
      {activeWorkFilter === "lead_follow_up" ? (
        <div className="awl-work-filter" role="status">
          <span>{dash.filterActive.replace("{label}", dash.leadsFollowUp)}</span>
          <button type="button" className="awu-btn" onClick={() => setActiveWorkFilter(null)}>
            {dash.clearFilter}
          </button>
        </div>
      ) : null}

      <div className="awr-toolbar">
        <label className="awr-search">
          <MobileIcon name="search" size={18} color={theme.textSecondary} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={c.search}
            aria-label={c.search}
            data-testid="leads.search"
          />
        </label>
        <button
          type="button"
          className={`awu-btn awr-filter-btn${chips.length ? " is-on" : ""}`}
          onClick={() => {
            setDraft(location);
            setFilterOpen(true);
          }}
          data-testid="leads.filters"
        >
          <MobileIcon name="funnel" size={16} color="currentColor" />
          {c.searchFilters}
          {chips.length ? <span className="awr-filter-count">{chips.length}</span> : null}
        </button>
        <div className="awr-sort-select awl-sort">
          <AgentSelect
            aria-label={c.sortTitle}
            value={sort}
            onChange={(event) => {
              setSort(event.target.value as AgentLeadsSort);
              setPage(1);
            }}
            data-testid="leads.sort"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </AgentSelect>
        </div>
        <span className="awr-count" aria-live="polite">
          {state === "ready" ? c.count.replace("{count}", total.toLocaleString(localeTag)) : " "}
        </span>
      </div>

      <div className="awl-status-row" role="group" aria-label={c.statusFilter}>
        {STATUS_CHIPS.map((value) => {
          const selected = status === value;
          const count = counts ? (value ? counts[value] : Object.values(counts).reduce((sum, n) => sum + n, 0)) : null;
          return (
            <MobileFilterChip
              key={value ?? "all"}
              label={value ? c.statuses[value] : c.statusAll}
              count={count}
              selected={selected}
              tone={value ? leadStatusTone(value) : "slate"}
              showDot={!!value}
              onPress={() => {
                setStatus(selected ? null : value);
                setPage(1);
              }}
            />
          );
        })}
      </div>

      {chips.length ? (
        <div className="awr-chips">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              className="awr-chip"
              onClick={() => applyLocation(chip.next)}
              aria-label={`${c.clearFilters} ${chip.label}`}
            >
              {chip.label}
              <MobileIcon name="close" size={12} color="currentColor" />
            </button>
          ))}
          <button type="button" className="awr-clear" onClick={() => applyLocation(NO_LOCATION)}>
            {c.clearFilters}
          </button>
        </div>
      ) : null}

      <div className={`awr-results${busy ? " is-busy" : ""}`} aria-busy={busy || state === "loading"}>
        <div className="awr-table-card">
          <WebTable
            label={web.tableLabel}
            columns={columns}
            rows={items}
            rowKey={(lead) => lead.id}
            status={state}
            onRetry={() => setRefresh((n) => n + 1)}
            filtered={filtered}
            onClearFilters={clearAll}
            empty={{
              title: web.emptyTitle,
              description: web.emptyBody,
              action: onAddLead ? (
                <button type="button" className="awu-btn awu-btn-primary" onClick={onAddLead}>
                  {c.create}
                </button>
              ) : undefined,
            }}
            onRowPress={(lead) => onOpenLead(lead)}
            skeletonRows={8}
            testID="leads.table"
          />
          {state === "error" && errorText ? <p className="awl-error-detail">{errorText}</p> : null}
        </div>
      </div>

      {state === "ready" && total > 0 ? (
        <nav className="awr-pager" aria-label={pager.pages}>
          <span className="awr-pager-range">
            {pager.pageRange
              .replace("{from}", range.from.toLocaleString(localeTag))
              .replace("{to}", range.to.toLocaleString(localeTag))
              .replace("{total}", total.toLocaleString(localeTag))}
          </span>
          {range.pages > 1 ? (
            <span className="awr-pager-buttons">
              <button type="button" className="awr-page-btn" onClick={() => goToPage(page - 1)} disabled={page <= 1} aria-label={pager.prevPage}>
                <MobileIcon name="chevron-left" size={16} color="currentColor" />
              </button>
              {pageButtons(page, range.pages).map((n, i) =>
                n == null ? (
                  <span key={`gap-${i}`} className="awr-page-gap" aria-hidden="true">
                    …
                  </span>
                ) : (
                  <button
                    key={n}
                    type="button"
                    className={`awr-page-btn${n === page ? " is-current" : ""}`}
                    aria-current={n === page ? "page" : undefined}
                    onClick={() => goToPage(n)}
                  >
                    {n.toLocaleString(localeTag)}
                  </button>
                ),
              )}
              <button
                type="button"
                className="awr-page-btn"
                onClick={() => goToPage(page + 1)}
                disabled={page >= range.pages}
                aria-label={pager.nextPage}
              >
                <MobileIcon name="chevron-right" size={16} color="currentColor" />
              </button>
            </span>
          ) : null}
        </nav>
      ) : null}

      <WebDialog
        open={filterOpen}
        title={c.searchFilters}
        onClose={() => setFilterOpen(false)}
        size="md"
        testID="leads.filterDialog"
        footer={
          <>
            <button type="button" className="awu-btn" onClick={() => setDraft(NO_LOCATION)}>
              {c.clearFilters}
            </button>
            <button
              type="button"
              className="awu-btn awu-btn-primary"
              onClick={() => {
                applyLocation({ ...draft, includeUnspecified: draft.locations.length > 0 && draft.includeUnspecified });
                setFilterOpen(false);
              }}
            >
              {c.applyFilters}
            </button>
          </>
        }
      >
        <div className="awl-filter-body">
          <LeadLocationPicker
            filter
            province={draft.province}
            locations={draft.locations}
            onChange={(province, locations) =>
              setDraft((current) => ({
                province,
                locations,
                includeUnspecified: locations.length > 0 && current.includeUnspecified,
              }))
            }
          />
          {draft.locations.length > 0 ? (
            <label className="awl-check">
              <input
                type="checkbox"
                checked={draft.includeUnspecified}
                onChange={(event) => setDraft((current) => ({ ...current, includeUnspecified: event.target.checked }))}
              />
              {c.includeUnspecified}
            </label>
          ) : null}
        </div>
      </WebDialog>
    </div>
  );
}
