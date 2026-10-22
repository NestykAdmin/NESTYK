import React, { useEffect, useId, useState } from "react";
import { AgentSelect } from "./agent-web/AgentSelect";
import { useLocale } from "@nestyk/i18n";
import type { LeadLocationCatalog } from "@nestyk/types";
import { fetchLeadLocations } from "../lib/agent-leads-api";
import "./agent-web/agent-fields.css";

export function LeadLocationPicker({
  province,
  locations,
  onChange,
  filter = false,
  provinceOnly = false,
  disabled = false,
  markRequired = true,
  error,
}: {
  province: string;
  locations: string[];
  onChange: (province: string, locations: string[]) => void;
  filter?: boolean;
  provinceOnly?: boolean;
  disabled?: boolean;
  markRequired?: boolean;
  error?: string;
}) {
  const { t, locale } = useLocale();
  const c = t.agent.leads;
  const id = useId();
  const [catalog, setCatalog] = useState<LeadLocationCatalog>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    fetchLeadLocations()
      .then((rows) => {
        if (active) setCatalog(rows);
      })
      .catch(() => {
        if (active) setFailed(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [retry]);
  const selected = catalog.find((p) => p.name === province);
  const areas = [
    ...new Set([...(selected?.locations ?? []), ...locations]),
  ].filter((area) =>
    area
      .toLocaleLowerCase(locale)
      .includes(search.trim().toLocaleLowerCase(locale)),
  );
  return (
    <div className="adf-location">
      <label className="adf-label" htmlFor={id}>
        {c.province}
        {!filter && markRequired ? " *" : ""}
      </label>
      <div className="adf-select">
        <AgentSelect
          id={id}
          value={province}
          disabled={disabled || loading || failed}
          aria-invalid={!!error}
          onChange={(e) => {
            onChange(
              e.target.value,
              e.target.value === province ? locations : [],
            );
            setSearch("");
          }}
        >
          <option value="">{filter ? c.allProvinces : c.selectProvince}</option>
          {province && !selected && (
            <option value={province}>{province}</option>
          )}
          {catalog.map((p) => (
            <option key={p.name} value={p.name}>
              {locale === "th" ? p.name : p.nameEn}
            </option>
          ))}
        </AgentSelect>
      </div>
      {loading && <small role="status">{t.common.loading}</small>}
      {failed && (
        <div className="adf-error" role="alert">
          {c.loadError}{" "}
          <button type="button" onClick={() => setRetry((n) => n + 1)}>
            {c.retry}
          </button>
        </div>
      )}
      {error && (
        <small className="adf-error" role="alert">
          {error}
        </small>
      )}
      {province && !provinceOnly && (
        <>
          <label className="adf-label" htmlFor={`${id}-search`}>
            {c.areas}
          </label>
          <input
            id={`${id}-search`}
            className="adf-input"
            type="search"
            placeholder={c.searchLocations}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            disabled={disabled}
          />
          <div className="adf-areas">
            {areas.map((area) => (
              <label key={area}>
                <input
                  type="checkbox"
                  checked={locations.includes(area)}
                  disabled={disabled}
                  onChange={(e) =>
                    onChange(
                      province,
                      e.target.checked
                        ? [...locations, area]
                        : locations.filter((a) => a !== area),
                    )
                  }
                />
                <span>{area}</span>
              </label>
            ))}
            {!areas.length && <small>{search ? c.noMatches : c.noAreas}</small>}
          </div>
          {locations.length > 0 && (
            <button
              className="adf-clear"
              type="button"
              disabled={disabled}
              onClick={() => onChange(province, [])}
            >
              {c.clearFilters}
            </button>
          )}
          {!filter && <small>{c.areasHint}</small>}
        </>
      )}
    </div>
  );
}
