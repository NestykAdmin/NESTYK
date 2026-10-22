import React, { useEffect, useId, useState } from "react";
import { useLocale } from "@nestyk/i18n";
import {
  MobileIcon,
  useMobileTheme,
  type AppIconName,
} from "@nestyk/ui/native";
import {
  interpolate,
  type DashboardSectionStatus,
  type AgentDashboardDeepLink,
  type AgentWorkItemKind,
} from "@nestyk/feature-listing";
import { WebContentContainer } from "@nestyk/ui/web-content";
import type { AgentOverviewProps } from "./AgentOverview.types";
import "./agent-overview.css";

const WORK_ICONS: Record<AgentWorkItemKind, AppIconName> = {
  overdue_payment: "credit-card",
  lead_follow_up: "users",
  awaiting_signature: "pencil",
  renewal: "calendar",
};
const WORK_ORDER: Record<AgentWorkItemKind, number> = {
  overdue_payment: 0,
  lead_follow_up: 1,
  awaiting_signature: 2,
  renewal: 3,
};
const isReady = (status: DashboardSectionStatus) =>
  status === "available" || status === "demo";

function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  return <span className={`aov-pill aov-tone-${tone}`}>{children}</span>;
}

function Panel({
  title,
  action,
  className = "",
  children,
}: {
  title: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <section className={`aov-panel ${className}`} aria-labelledby={id}>
      <div className="aov-panel-heading">
        <h2 id={id}>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function AgentOverview({
  snapshot,
  onNavigate,
  onRefresh,
}: AgentOverviewProps) {
  const { t, locale } = useLocale();
  const { theme } = useMobileTheme();
  const copy = t.agent.dashboard;
  const web = copy.webOverview;
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const localeTag = { th: "th-TH", en: "en-GB", zh: "zh-CN", ja: "ja-JP" }[
    locale
  ];
  const money = (amount: number, currency = snapshot.business.currency) =>
    new Intl.NumberFormat(localeTag, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  const number = (value: number) =>
    new Intl.NumberFormat(localeTag).format(value);
  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString(localeTag, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  const period = (year: number, month: number) =>
    new Date(year, month - 1, 1).toLocaleDateString(localeTag, {
      month: "long",
      year: "numeric",
    });
  const today = snapshot.schedule.items
    .filter(
      (item) => new Date(item.startsAt).toDateString() === now.toDateString(),
    )
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const nextAppointment = today.find(
    (item) => Date.parse(item.startsAt) >= now.getTime(),
  );
  const work = snapshot.actionRequired.items
    .filter((item) => item.count > 0)
    .sort((a, b) => WORK_ORDER[a.kind] - WORK_ORDER[b.kind]);
  const workCount = work.reduce((total, item) => total + item.count, 0);
  const rentPct =
    snapshot.rent.totalDue > 0
      ? Math.max(
          0,
          Math.min(
            100,
            (snapshot.rent.received / snapshot.rent.totalDue) * 100,
          ),
        )
      : 0;
  const otherOutstanding = Math.max(
    0,
    snapshot.rent.totalDue - snapshot.rent.received - snapshot.rent.overdue,
  );
  const commissionPct =
    snapshot.commission.total > 0
      ? Math.max(
          0,
          Math.min(
            100,
            (snapshot.commission.received / snapshot.commission.total) * 100,
          ),
        )
      : 0;
  const percent = (value: number) =>
    new Intl.NumberFormat(localeTag, { maximumFractionDigits: 1 }).format(
      value,
    );

  const link = (label: string, destination: AgentDashboardDeepLink) => (
    <button
      type="button"
      className="aov-text-link"
      onClick={() => onNavigate(destination)}
    >
      {label}
      <MobileIcon name="chevron-right" size={14} color="currentColor" />
    </button>
  );
  const state = (
    status: DashboardSectionStatus,
    content: React.ReactNode,
    empty = false,
    emptyText = t.common.noData,
  ) => {
    if (status === "loading")
      return (
        <div
          className="aov-loading"
          role="status"
          aria-label={t.common.loading}
        >
          <span />
          <span />
          <span />
        </div>
      );
    if (!isReady(status))
      return (
        <div className="aov-empty" role="status">
          <MobileIcon
            name={status === "error" ? "warning" : "info"}
            size={24}
            color={theme.textSecondary}
          />
          <p>{status === "error" ? web.loadFailed : copy.unavailableSection}</p>
          {status === "error" && onRefresh ? (
            <button
              type="button"
              className="aw-button aw-button-secondary"
              onClick={onRefresh}
            >
              {t.agent.tenants.retry}
            </button>
          ) : null}
        </div>
      );
    return empty ? <p className="aov-empty">{emptyText}</p> : content;
  };
  const workTitle: Record<AgentWorkItemKind, string> = {
    overdue_payment: copy.overduePayments,
    lead_follow_up: copy.leadsFollowUp,
    awaiting_signature: copy.awaitingSignature,
    renewal: copy.renewalSoon,
  };
  const workHint = (item: (typeof work)[number]) => {
    if (item.kind === "overdue_payment")
      return item.amount != null
        ? interpolate(copy.overdueAmountHint, {
            amount: money(item.amount, snapshot.rent.currency),
          })
        : interpolate(copy.itemsCount, { count: number(item.count) });
    return interpolate(
      item.kind === "lead_follow_up"
        ? copy.followUpHint
        : item.kind === "awaiting_signature"
          ? copy.signingHint
          : copy.renewalHint,
      { count: number(item.count) },
    );
  };
  const kpis: Array<{
    label: string;
    value: string;
    sub?: string;
    icon: AppIconName;
    status: DashboardSectionStatus;
    destination?: AgentDashboardDeepLink;
  }> = [
    {
      label: copy.availableListings,
      value: number(snapshot.business.availableListings),
      sub: interpolate(copy.ofTotal, {
        count: number(snapshot.business.totalListings),
      }),
      icon: "buildings",
      status: snapshot.business.status,
      destination: { type: "tab", tab: "listingRoom" },
    },
    {
      label: copy.openLeads,
      value: number(snapshot.business.openLeads),
      icon: "clipboard",
      status: snapshot.business.status,
      destination: { type: "tab", tab: "listingLead" },
    },
    {
      label: copy.currentClients,
      value: number(snapshot.business.currentClients),
      sub: interpolate(copy.tenantsCount, {
        count: number(snapshot.business.tenantsCount),
      }),
      icon: "handshake",
      status: snapshot.business.status,
      destination: { type: "tab", tab: "clients" },
    },
    {
      label: web.viewingsToday,
      value: number(today.filter((item) => item.kind === "viewing").length),
      sub: snapshot.localDateLabel,
      icon: "calendar",
      status: snapshot.schedule.status,
      destination: { type: "tab", tab: "calendar" },
    },
    {
      label: copy.agentCommission,
      value: money(snapshot.commission.total, snapshot.commission.currency),
      sub: period(
        snapshot.commission.periodYear,
        snapshot.commission.periodMonth,
      ),
      icon: "wallet",
      status: snapshot.commission.status,
    },
  ];
  const activityText = {
    lead_added: copy.activityLeadAdded,
    contract_sent: copy.activityContractSent,
    payment_recorded: copy.activityPaymentRecorded,
  };
  const activityIcon: Record<keyof typeof activityText, AppIconName> = {
    lead_added: "user-plus",
    contract_sent: "file-text",
    payment_recorded: "credit-card",
  };

  return (
    <div
      className="aov-scroll"
      data-testid="agent-desktop-overview"
      data-theme={theme.mode}
      style={{
        "--aw-bg": theme.background,
        "--aw-surface": theme.surface,
        "--aw-ink": theme.screenTitle,
        "--aw-muted": theme.textSecondary,
        "--aw-border": theme.border,
        "--aw-brand": "#f4bd42",
      } as React.CSSProperties}
    >
      <WebContentContainer>
      <div className="aov-dashboard">
        <header className="aov-intro">
          <div>
            <p className="aov-eyebrow">{t.mobile.tabs.dashboard}</p>
            <h1>
              {interpolate(copy.welcome, { name: snapshot.greetingName })}
            </h1>
            <p className="aov-date">{snapshot.localDateLabel}</p>
          </div>
          <div className="aov-quick-actions">
            <button
              type="button"
              className="aw-button aw-button-primary"
              onClick={() => onNavigate({ type: "action", id: "addListing" })}
            >
              <MobileIcon name="plus" size={18} color="#382b12" />
              {copy.addListing}
            </button>
            <button
              type="button"
              className="aw-button aw-button-secondary"
              onClick={() => onNavigate({ type: "action", id: "newLead" })}
            >
              <MobileIcon
                name="user-plus"
                size={18}
                color={theme.screenTitle}
              />
              {copy.newLead}
            </button>
          </div>
        </header>
        {snapshot.isDemoPreview ? (
          <div className="aov-demo" role="note">
            <MobileIcon name="info" size={16} color="currentColor" />
            <span>{copy.demoBanner}</span>
          </div>
        ) : null}
        <section className="aov-kpis" aria-label={copy.businessOverview}>
          {kpis.map((item) => {
            const content = (
              <>
                <div className="aov-kpi-top">
                  <span>{item.label}</span>
                  <MobileIcon
                    name={item.icon}
                    size={21}
                    color={theme.textSecondary}
                  />
                </div>
                {isReady(item.status) ? (
                  <>
                    <strong className="aov-kpi-value">{item.value}</strong>
                    <span className="aov-kpi-sub">{item.sub || "\u00a0"}</span>
                  </>
                ) : item.status === "loading" ? (
                  <span
                    className="aov-kpi-skeleton"
                    role="status"
                    aria-label={t.common.loading}
                  />
                ) : (
                  <>
                    <strong className="aov-kpi-value">—</strong>
                    <span className="aov-kpi-sub">
                      {copy.unavailableSection}
                    </span>
                  </>
                )}
              </>
            );
            const destination = item.destination;
            return destination ? (
              <button
                type="button"
                className="aov-kpi"
                key={item.label}
                onClick={() => onNavigate(destination)}
              >
                {content}
              </button>
            ) : (
              <div className="aov-kpi" key={item.label}>
                {content}
              </div>
            );
          })}
        </section>

        <div className="aov-grid aov-work-grid">
          <Panel
            title={copy.actionRequired}
            action={
              isReady(snapshot.actionRequired.status) && workCount > 0 ? (
                <span className="aov-work-total">{number(workCount)}</span>
              ) : null
            }
          >
            {state(
              snapshot.actionRequired.status,
              <div className="aov-work-list">
                {work.map((item) => (
                  <button
                    type="button"
                    className={`aov-work-row ${item.kind === "overdue_payment" ? "aov-overdue" : ""}`}
                    key={item.id}
                    onClick={() => onNavigate(item.deepLink)}
                  >
                    <span
                      className={`aov-icon-well aov-tone-${item.kind === "overdue_payment" ? "danger" : item.kind === "awaiting_signature" ? "warning" : "neutral"}`}
                    >
                      <MobileIcon
                        name={WORK_ICONS[item.kind]}
                        size={19}
                        color="currentColor"
                      />
                    </span>
                    <span className="aov-row-copy">
                      <strong>{workTitle[item.kind]}</strong>
                      <small>{workHint(item)}</small>
                    </span>
                    <span className="aov-row-count">{number(item.count)}</span>
                    <MobileIcon
                      name="chevron-right"
                      size={16}
                      color={theme.textSecondary}
                    />
                  </button>
                ))}
              </div>,
              work.length === 0,
              copy.emptyActions,
            )}
          </Panel>
          <Panel
            title={copy.todaysSchedule}
            action={link(copy.viewCalendar, { type: "tab", tab: "calendar" })}
          >
            {state(
              snapshot.schedule.status,
              <div className="aov-schedule-list">
                {today.slice(0, 4).map((item) => (
                  <button
                    type="button"
                    className={`aov-appointment ${item.id === nextAppointment?.id ? "is-next" : ""}`}
                    key={item.id}
                    onClick={() =>
                      onNavigate({
                        type: "action",
                        id: "viewAppointment",
                        appointmentId: item.id,
                      })
                    }
                  >
                    <time dateTime={item.startsAt}>{time(item.startsAt)}</time>
                    <span className="aov-row-copy">
                      <strong>{item.title}</strong>
                      <small>
                        {item.kind === "viewing"
                          ? copy.apptViewing
                          : copy.apptFollowUp}{" "}
                        · {item.contactName}
                      </small>
                      {item.id === nextAppointment?.id ? (
                        <span className="aov-next-label">{copy.upNext}</span>
                      ) : null}
                    </span>
                    <Pill
                      tone={item.status === "confirmed" ? "success" : "warning"}
                    >
                      {item.status === "confirmed"
                        ? copy.statusConfirmed
                        : copy.statusPending}
                    </Pill>
                  </button>
                ))}
              </div>,
              today.length === 0,
              copy.noAppointments,
            )}
          </Panel>
        </div>

        <div className="aov-grid aov-portfolio-grid">
          <Panel
            title={copy.listingInventory}
            action={link(copy.viewAllListings, {
              type: "tab",
              tab: "listingRoom",
            })}
          >
            {state(
              snapshot.inventory.status,
              <>
                <div className="aov-inventory-summary">
                  <div>
                    <span>{copy.availability}</span>
                    <p>
                      <strong>{number(snapshot.inventory.available)}</strong>{" "}
                      {copy.available}
                      <i />
                      {number(snapshot.inventory.unavailable)}{" "}
                      {copy.unavailable}
                    </p>
                    <div className="aov-ratio" aria-hidden="true">
                      <span
                        style={{
                          width: `${snapshot.inventory.available + snapshot.inventory.unavailable > 0 ? (snapshot.inventory.available / (snapshot.inventory.available + snapshot.inventory.unavailable)) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <span>{copy.visibility}</span>
                    <p>
                      <strong>{number(snapshot.inventory.published)}</strong>{" "}
                      {copy.published}
                      <i />
                      {number(snapshot.inventory.private)} {copy.private}
                    </p>
                    <div
                      className="aov-ratio aov-ratio-brand"
                      aria-hidden="true"
                    >
                      <span
                        style={{
                          width: `${snapshot.inventory.published + snapshot.inventory.private > 0 ? (snapshot.inventory.published / (snapshot.inventory.published + snapshot.inventory.private)) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
                {snapshot.inventory.preview.length ? (
                  <div
                    className="aov-table-scroll"
                    tabIndex={0}
                    role="region"
                    aria-label={copy.listingInventory}
                  >
                    <table className="aov-stock-table">
                      <thead>
                        <tr>
                          <th scope="col">{web.property}</th>
                          <th scope="col">{web.rent}</th>
                          <th scope="col">{copy.availability}</th>
                          <th scope="col">{copy.visibility}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {snapshot.inventory.preview.slice(0, 5).map((room) => (
                          <tr key={room.id}>
                            <td>
                              <button
                                type="button"
                                className="aov-property"
                                onClick={() =>
                                  onNavigate({
                                    type: "tab",
                                    tab: "listingRoom",
                                  })
                                }
                              >
                                <span className="aov-property-icon">
                                  <MobileIcon
                                    name="buildings"
                                    size={22}
                                    color={theme.textSecondary}
                                  />
                                </span>
                                <span>
                                  <strong>{room.title}</strong>
                                  <small>
                                    {interpolate(copy.bedsArea, {
                                      beds: room.beds,
                                      area: room.area,
                                    })}
                                  </small>
                                </span>
                              </button>
                            </td>
                            <td className="aov-price">
                              {money(room.price, snapshot.business.currency)}
                            </td>
                            <td>
                              <Pill
                                tone={
                                  room.availability === "available"
                                    ? "success"
                                    : "neutral"
                                }
                              >
                                {room.availability === "available"
                                  ? copy.available
                                  : copy.unavailable}
                              </Pill>
                            </td>
                            <td>
                              <Pill
                                tone={
                                  room.visibility === "published"
                                    ? "info"
                                    : "neutral"
                                }
                              >
                                {room.visibility === "published"
                                  ? copy.published
                                  : copy.private}
                              </Pill>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="aov-empty">{t.common.noData}</p>
                )}
              </>,
            )}
          </Panel>
          <Panel
            title={copy.clientOverview}
            action={link(copy.viewClients, { type: "tab", tab: "clients" })}
          >
            {state(
              snapshot.clients.status,
              <>
                <div className="aov-client-stats">
                  {[
                    {
                      label: copy.draft,
                      value: snapshot.clients.draft,
                      destination: { type: "tab", tab: "clients" },
                    },
                    {
                      label: copy.signing,
                      value: snapshot.clients.signing,
                      destination: {
                        type: "tab",
                        tab: "clients",
                        filter: { kind: "work", work: "awaiting_signature" },
                      },
                    },
                    {
                      label: copy.tenants,
                      value: snapshot.clients.tenants,
                      destination: { type: "tab", tab: "clients" },
                    },
                  ].map((item) => (
                    <button
                      type="button"
                      key={item.label}
                      onClick={() =>
                        onNavigate(item.destination as AgentDashboardDeepLink)
                      }
                    >
                      <strong>{number(item.value)}</strong>
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
                {snapshot.clients.renewal ? (
                  <div className="aov-renewal">
                    <div className="aov-renewal-heading">
                      <MobileIcon
                        name="calendar"
                        size={16}
                        color="currentColor"
                      />
                      <span>{copy.upcomingRenewal}</span>
                      <Pill tone="warning">
                        {interpolate(copy.daysLeft, {
                          count: snapshot.clients.renewal.daysLeft,
                        })}
                      </Pill>
                    </div>
                    <strong>{snapshot.clients.renewal.title}</strong>
                    <div className="aov-renewal-footer">
                      <span>
                        {interpolate(copy.endsOn, {
                          date: new Date(
                            snapshot.clients.renewal.endsAt,
                          ).toLocaleDateString(localeTag, {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          }),
                        })}
                      </span>
                      {link(copy.review, {
                        type: "tab",
                        tab: "clients",
                        filter: { kind: "work", work: "renewal" },
                      })}
                    </div>
                  </div>
                ) : null}
              </>,
            )}
          </Panel>
        </div>

        <div className="aov-grid aov-finance-grid">
          <Panel
            title={copy.rentCollection}
            action={
              <span className="aov-period">
                {period(snapshot.rent.periodYear, snapshot.rent.periodMonth)}
              </span>
            }
          >
            {state(
              snapshot.rent.status,
              <>
                <div className="aov-finance-total">
                  <strong>
                    {money(snapshot.rent.totalDue, snapshot.rent.currency)}
                  </strong>
                  <span>{copy.totalDue}</span>
                </div>
                <div className="aov-payment-progress">
                  <span>
                    {interpolate(copy.receivedPercent, {
                      pct: percent(rentPct),
                    })}
                  </span>
                  <progress
                    max={100}
                    value={rentPct}
                    aria-label={copy.rentCollection}
                  />
                </div>
                <dl className="aov-money-split">
                  <div>
                    <dt>{copy.received}</dt>
                    <dd className="aov-money-success">
                      {money(snapshot.rent.received, snapshot.rent.currency)}
                    </dd>
                  </div>
                  <div>
                    <dt>{copy.overdue}</dt>
                    <dd className="aov-money-danger">
                      {money(snapshot.rent.overdue, snapshot.rent.currency)}
                    </dd>
                  </div>
                </dl>
                {otherOutstanding > 0 ? (
                  <p className="aov-outstanding">
                    {web.balance}{" "}
                    {money(otherOutstanding, snapshot.rent.currency)}
                  </p>
                ) : null}
                <div className="aov-panel-footer">
                  {link(copy.viewPayments, {
                    type: "action",
                    id: "viewPayments",
                  })}
                </div>
              </>,
            )}
          </Panel>
          <Panel
            title={copy.agentCommission}
            action={
              <span className="aov-period">
                {period(
                  snapshot.commission.periodYear,
                  snapshot.commission.periodMonth,
                )}
              </span>
            }
          >
            {state(
              snapshot.commission.status,
              <>
                <div className="aov-finance-total">
                  <strong>
                    {money(
                      snapshot.commission.total,
                      snapshot.commission.currency,
                    )}
                  </strong>
                  <span>{copy.totalThisMonth}</span>
                </div>
                <div className="aov-payment-progress aov-commission-progress">
                  <span>
                    {interpolate(copy.receivedPercent, {
                      pct: percent(commissionPct),
                    })}
                  </span>
                  <progress
                    max={100}
                    value={commissionPct}
                    aria-label={copy.agentCommission}
                  />
                </div>
                <dl className="aov-money-split">
                  <div>
                    <dt>{copy.received}</dt>
                    <dd className="aov-money-success">
                      {money(
                        snapshot.commission.received,
                        snapshot.commission.currency,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>{copy.pendingAmount}</dt>
                    <dd className="aov-money-warning">
                      {money(
                        snapshot.commission.pending,
                        snapshot.commission.currency,
                      )}
                    </dd>
                  </div>
                </dl>
                <div className="aov-panel-footer aov-coming-soon">
                  <MobileIcon
                    name="info"
                    size={14}
                    color={theme.textSecondary}
                  />
                  <span>
                    {copy.openCommission} · {copy.comingSoon}
                  </span>
                </div>
              </>,
            )}
          </Panel>
          <Panel title={copy.recentActivity}>
            {state(
              snapshot.activity.status,
              <div className="aov-activity-list">
                {[...snapshot.activity.items]
                  .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
                  .slice(0, 5)
                  .map((item) => (
                    <button
                      type="button"
                      className="aov-activity-row"
                      key={item.id}
                      onClick={() => onNavigate(item.deepLink)}
                    >
                      <span className="aov-activity-icon">
                        <MobileIcon
                          name={activityIcon[item.kind]}
                          size={17}
                          color={theme.textSecondary}
                        />
                      </span>
                      <span className="aov-row-copy">
                        <strong>
                          {interpolate(activityText[item.kind], {
                            subject: item.subject,
                          })}
                        </strong>
                        <time dateTime={item.at}>{time(item.at)}</time>
                      </span>
                      <MobileIcon
                        name="chevron-right"
                        size={14}
                        color={theme.textSecondary}
                      />
                    </button>
                  ))}
              </div>,
              snapshot.activity.items.length === 0,
            )}
          </Panel>
        </div>
      </div>
      </WebContentContainer>
    </div>
  );
}
