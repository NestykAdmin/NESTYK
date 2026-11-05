import React from "react";
import { MobileIcon, type AppIconName } from "@nestyk/ui/native";
import { useLocale } from "@nestyk/i18n";
import type { TenantSection } from "../../lib/tenant-detail";
import { initials } from "../TenantDetailHub";
import type { TenantDetailFrameProps } from "./TenantDetailFrame.types";
import "./agent-tenants.css";

/**
 * Agent web tenant page (W5, Mos 5 Nov 2026): the sections as a side menu, the same section bodies on the right.
 * The menu calls the same `setSection` as the hub rows; content, actions, edit and back are the app's own.
 */
export function TenantDetailFrame({ web, name, place, section, onSection, disabled = false, children }: TenantDetailFrameProps) {
  const { t } = useLocale();
  const d = t.agent.tenants.detail;
  if (!web) return <>{children}</>;

  const items: Array<{ key: TenantSection | null; icon: AppIconName; label: string }> = [
    { key: null, icon: "grid", label: d.webOverview },
    { key: "profile", icon: "user", label: d.sectionProfile },
    { key: "room", icon: "home", label: d.sectionRoom },
    { key: "contracts", icon: "file-text", label: d.sectionContracts },
    { key: "bills", icon: "credit-card", label: d.sectionBills },
    { key: "payments", icon: "wallet", label: d.sectionPayments },
    { key: "attachments", icon: "files", label: d.sectionAttachments },
  ];

  return (
    <div className="awt-detail" data-testid="tenant.detail">
      <aside className="awt-detail-side">
        <div className="awt-detail-who">
          <span className="awt-avatar awt-avatar-lg" aria-hidden="true">
            {initials(name)}
          </span>
          <span className="awr-room">
            <strong>{name}</strong>
            {place ? <small>{place}</small> : null}
          </span>
        </div>
        <nav aria-label={d.webSections}>
          <ul className="awt-detail-nav">
            {items.map((item) => {
              const current = section === item.key;
              return (
                <li key={item.key ?? "overview"}>
                  <button
                    type="button"
                    className={`awt-detail-link${current ? " is-current" : ""}`}
                    aria-current={current ? "page" : undefined}
                    disabled={disabled && !current}
                    onClick={() => {
                      if (!current) onSection(item.key);
                    }}
                    data-testid={`tenant.section.${item.key ?? "overview"}`}
                  >
                    <MobileIcon name={item.icon} size={18} color="currentColor" />
                    {item.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
      <div className="awt-detail-main">{children}</div>
    </div>
  );
}
