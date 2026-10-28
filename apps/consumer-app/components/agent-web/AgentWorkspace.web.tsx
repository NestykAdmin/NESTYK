import React, { useEffect, useRef } from "react";
import { useLocale, type SupportedLocale } from "@nestyk/i18n";
import {
  MobileIcon,
  MobileNestykLogo,
  useMobileTheme,
  type MobileModePageProps,
} from "@nestyk/ui/native";
import { WebContentContainer } from "@nestyk/ui/web-content";
import type { UserRole } from "@nestyk/types";
import type { AgentWorkspaceProps, WorkspaceNavItem } from "./AgentWorkspace.types";
import {
  AGENT_WEB_PRIMARY,
  AGENT_WEB_MORE,
  agentWebParent,
} from "./navigation";
import "./agent-workspace.css";
import { AgentSelect } from "./AgentSelect";

const ROLES: UserRole[] = ["guest", "tenant", "landlord", "agent", "admin"];

export function AgentWorkspace(props: AgentWorkspaceProps) {
  const { t, locale, setLocale } = useLocale();
  const { theme, isDark, setThemeMode } = useMobileTheme();
  const [collapsed, setCollapsed] = React.useState(false);
  const [notificationTab, setNotificationTab] = React.useState<
    "activity" | "messages"
  >("activity");
  const accountRef = useRef<HTMLDetailsElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const copy = t.agent.dashboard.webWorkspace;
  const parent = agentWebParent(props.activeTab);

  useEffect(() => {
    if (!props.enabled) return;
    const closeAccount = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !accountRef.current?.contains(event.target)
      ) {
        accountRef.current?.removeAttribute("open");
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && accountRef.current?.open) {
        accountRef.current.removeAttribute("open");
        accountRef.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", closeAccount);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", closeAccount);
      document.removeEventListener("keydown", escape);
    };
  }, [props.enabled]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (props.enabled && props.notificationsOpen && dialog && !dialog.open)
      dialog.showModal();
    else if (dialog?.open) dialog.close();
  }, [props.enabled, props.notificationsOpen]);

  if (!props.enabled)
    return <>{props.children}</>;

  const navigate = (tab: Parameters<AgentWorkspaceProps["onNavigate"]>[0]) => {
    accountRef.current?.removeAttribute("open");
    props.onNavigate(tab);
  };
  const menuLabel = (item: (typeof AGENT_WEB_PRIMARY)[number]) =>
    item.labelKey ? t.agent.dashboard[item.labelKey] : t.mobile.tabs[item.tab];
  const shellRole = props.activeRole ?? "agent";
  const workspaceLabel = props.workspaceLabel ?? t.agent.dashboard.workspaceLabel;
  const customCurrent = props.navSections
    ?.flatMap((section) => section.items)
    .find((item) => item.active);
  const currentMenu = [...AGENT_WEB_PRIMARY, ...AGENT_WEB_MORE].find(
    (item) => item.tab === props.activeTab,
  );
  const itemColor = (active: boolean) =>
    active ? (isDark ? "#f4cd76" : "#795719") : theme.textSecondary;
  const customItem = (item: WorkspaceNavItem) => (
    <button
      key={item.id}
      type="button"
      className={`aw-nav-item ${item.active ? "is-active" : ""}`}
      aria-current={item.active ? "page" : undefined}
      disabled={props.navigationDisabled || item.disabled}
      title={item.title ?? item.label}
      onClick={() => {
        if (props.navigationDisabled || item.disabled) return;
        accountRef.current?.removeAttribute("open");
        item.onPress();
      }}
    >
      <MobileIcon name={item.icon} size={20} color={itemColor(Boolean(item.active))} />
      <span className="aw-nav-label">{item.label}</span>
      {item.badge ? <span className="aw-soon aw-nav-label">{item.badge}</span> : null}
      {item.active ? <span className="aw-active-dot" /> : null}
    </button>
  );
  const navItem = (item: (typeof AGENT_WEB_PRIMARY)[number]) => (
    <button
      key={item.tab}
      type="button"
      className={`aw-nav-item ${parent === item.tab ? "is-active" : ""}`}
      aria-current={parent === item.tab ? "page" : undefined}
      disabled={props.navigationDisabled}
      title={menuLabel(item)}
      onClick={() => navigate(item.tab)}
    >
      <MobileIcon
        name={item.icon}
        size={20}
        color={itemColor(parent === item.tab)}
      />
      <span className="aw-nav-label">{menuLabel(item)}</span>
      {parent === item.tab ? <span className="aw-active-dot" /> : null}
    </button>
  );

  return (
      <div
        className={`aw-shell ${collapsed ? "aw-collapsed" : ""}`}
        data-theme={theme.mode}
        lang={locale}
        style={
          {
            "--aw-bg": theme.background,
            "--aw-surface": theme.surface,
            "--aw-ink": theme.screenTitle,
            "--aw-muted": theme.textSecondary,
            "--aw-border": theme.border,
          } as React.CSSProperties
        }
      >
        <a className="aw-skip-link" href="#agent-web-main">
          {copy.skip}
        </a>
        <aside className="aw-sidebar" aria-label={t.mobile.profile.navigation}>
          <button
            className="aw-brand"
            type="button"
            onClick={() => navigate("dashboard")}
            disabled={props.navigationDisabled}
            aria-label={`NESTYK ${t.mobile.tabs.dashboard}`}
          >
            <div className="aw-logo-wide">
              <MobileNestykLogo
                variant={isDark ? "wordmarkOnDark" : "wordmark"}
                height={32}
              />
            </div>
            <div className="aw-logo-compact">
              <MobileNestykLogo variant="markSecondary" height={32} />
            </div>
            <span className="aw-workspace-label">{props.brandTag ?? copy.brandTag}</span>
          </button>
          <div className="aw-sidebar-scroll">
            {props.navSections ? (
              props.navSections.map((section, index) => (
                <React.Fragment key={section.id}>
                  {index > 0 ? <div className="aw-nav-divider" /> : null}
                  <p className="aw-nav-caption">{section.caption}</p>
                  <nav className="aw-nav" aria-label={section.caption}>
                    {section.items.map(customItem)}
                  </nav>
                </React.Fragment>
              ))
            ) : (
              <>
                <p className="aw-nav-caption">{copy.main}</p>
                <nav className="aw-nav" aria-label={copy.main}>
                  {AGENT_WEB_PRIMARY.map(navItem)}
                </nav>
                <div className="aw-nav-divider" />
                <p className="aw-nav-caption">{t.mobile.tabs.more}</p>
                <nav className="aw-nav" aria-label={t.mobile.tabs.more}>
                  {AGENT_WEB_MORE.map(navItem)}
                </nav>
                <div className="aw-nav-divider" />
                <p className="aw-nav-caption">{t.agent.dashboard.financeSection}</p>
                <nav
                  className="aw-nav"
                  aria-label={t.agent.dashboard.financeSection}
                >
                  <button
                    type="button"
                    className="aw-nav-item"
                    disabled
                    title={`${t.agent.dashboard.openCommission} · ${t.agent.dashboard.comingSoon}`}
                  >
                    <MobileIcon
                      name="wallet"
                      size={20}
                      color={theme.textSecondary}
                    />
                    <span className="aw-nav-label">
                      {t.mobile.drawerMenu.commission}
                    </span>
                    <span className="aw-soon aw-nav-label">
                      {t.agent.dashboard.comingSoon}
                    </span>
                  </button>
                </nav>
              </>
            )}
          </div>
          <button
            type="button"
            className="aw-collapse"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? copy.expand : copy.collapse}
            aria-expanded={!collapsed}
          >
            <MobileIcon
              name={collapsed ? "chevron-right" : "chevron-left"}
              color={theme.textSecondary}
              size={18}
            />
            <span className="aw-nav-label">{copy.collapse}</span>
          </button>
        </aside>

        <div className="aw-workspace">
          <header className="aw-topbar">
            <div className="aw-breadcrumb">
              <span>{workspaceLabel}</span>
              <MobileIcon
                name="chevron-right"
                size={14}
                color={theme.textSecondary}
              />
              <strong>
                {customCurrent
                  ? customCurrent.label
                  : currentMenu
                    ? menuLabel(currentMenu)
                    : t.mobile.tabs[props.activeTab]}
              </strong>
            </div>
            <div className="aw-topbar-actions">
              {props.onRefresh ? (
                <button
                  type="button"
                  className="aw-button aw-button-secondary aw-refresh"
                  disabled={props.refreshing}
                  aria-busy={props.refreshing}
                  onClick={props.onRefresh}
                >
                  {props.refreshing ? t.common.loading : copy.refresh}
                </button>
              ) : null}
              <button
                className="aw-icon-button aw-notification-button"
                type="button"
                onClick={props.onNotificationsOpen}
                aria-label={`${t.mobile.notifications.title}${props.notificationCount ? ` (${props.notificationCount})` : ""}`}
              >
                <MobileIcon name="bell" size={21} color={theme.screenTitle} />
                {props.notificationCount > 0 ? (
                  <span className="aw-notification-dot" />
                ) : null}
              </button>
              <div className="aw-topbar-divider" />
              <details className="aw-account" ref={accountRef}>
                <summary aria-label={copy.account}>
                  <span className="aw-avatar">{props.initials}</span>
                  <span className="aw-account-name">
                    {props.userName}
                    <small>{t.roles[shellRole]}</small>
                  </span>
                  <MobileIcon
                    name="chevron-down"
                    size={14}
                    color={theme.textSecondary}
                  />
                </summary>
                <div className="aw-account-popover">
                  <div className="aw-account-info">
                    <strong>{props.userName}</strong>
                    <span>{props.userEmail}</span>
                  </div>
                  <label>
                    {t.mobile.profile.switchRole}
                    <AgentSelect
                      value={shellRole}
                      disabled={props.navigationDisabled}
                      onChange={(e) => {
                        accountRef.current?.removeAttribute("open");
                        props.onRoleChange(e.target.value as UserRole);
                      }}
                    >
                      {ROLES.map((role) => (
                        <option key={role} value={role}>
                          {t.roles[role]}
                        </option>
                      ))}
                    </AgentSelect>
                  </label>
                  <label>
                    {t.mobile.settings.language}
                    <AgentSelect
                      value={locale}
                      onChange={(e) =>
                        setLocale(e.target.value as SupportedLocale)
                      }
                    >
                      {Object.entries(t.mobile.settings.languageNames).map(
                        ([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ),
                      )}
                    </AgentSelect>
                  </label>
                  <label className="aw-theme-toggle">
                    <span>{t.mobile.settings.darkMode}</span>
                    <input
                      type="checkbox"
                      checked={isDark}
                      onChange={(e) =>
                        setThemeMode(e.target.checked ? "dark" : "light")
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="aw-signout"
                    disabled={props.navigationDisabled}
                    onClick={props.onSignOut}
                  >
                    {t.common.signOut}
                  </button>
                </div>
              </details>
            </div>
          </header>
          <main id="agent-web-main" className="aw-main" tabIndex={-1}>
            {props.children}
          </main>
        </div>
        <dialog
          className="aw-notifications"
          ref={dialogRef}
          onCancel={props.onNotificationsClose}
          onClose={props.onNotificationsClose}
          aria-label={t.mobile.notifications.title}
        >
          <div className="aw-notification-heading">
            <h2>{t.mobile.notifications.title}</h2>
            <button
              type="button"
              className="aw-icon-button"
              autoFocus
              onClick={props.onNotificationsClose}
              aria-label={copy.close}
            >
              <MobileIcon name="close" size={20} color={theme.screenTitle} />
            </button>
          </div>
          <div
            className="aw-notification-tabs"
            role="tablist"
            aria-label={t.mobile.notifications.title}
          >
            {(["activity", "messages"] as const).map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={notificationTab === key}
                tabIndex={notificationTab === key ? 0 : -1}
                onKeyDown={(event) => {
                  if (
                    !["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                      event.key,
                    )
                  )
                    return;
                  event.preventDefault();
                  const next =
                    event.key === "Home"
                      ? "activity"
                      : event.key === "End"
                        ? "messages"
                        : notificationTab === "activity"
                          ? "messages"
                          : "activity";
                  setNotificationTab(next);
                  document
                    .getElementById(`agent-notification-${next}`)
                    ?.focus();
                }}
                id={`agent-notification-${key}`}
                aria-controls="agent-notification-panel"
                onClick={() => setNotificationTab(key)}
              >
                {t.mobile.notifications[key]}
              </button>
            ))}
          </div>
          <div className="aw-notification-toolbar">
            <button type="button" onClick={props.onNotificationsClear}>
              {copy.readAll}
            </button>
          </div>
          <div
            id="agent-notification-panel"
            role="tabpanel"
            aria-labelledby={`agent-notification-${notificationTab}`}
          >
            {(notificationTab === "activity"
              ? props.activityItems
              : props.messageItems
            ).length === 0 ? (
              <p className="aw-notification-empty">{t.common.noData}</p>
            ) : null}
            {(notificationTab === "activity"
              ? props.activityItems
              : props.messageItems
            ).map((item) => (
              <div
                className={`aw-notification-row ${item.unread ? "is-unread" : ""}`}
                key={item.id}
              >
                <MobileIcon name={item.icon} size={20} color={item.iconColor} />
                <div>
                  <p>{item.text}</p>
                  <span>{item.time}</span>
                </div>
                {item.unread ? <span className="aw-unread-dot" /> : null}
              </div>
            ))}
          </div>
        </dialog>
      </div>
  );
}

/** Browser page body; native platforms continue using MobileModePage. */
export function AgentWorkspacePage({
  header,
  children,
  bottomBar,
  scrollable = true,
}: MobileModePageProps) {
  return (
    <div className="aw-page">
      {header ? (
        <div className="aw-page-header">
          <WebContentContainer>{header}</WebContentContainer>
        </div>
      ) : null}
      <div className={`aw-page-content ${scrollable ? "aw-page-scroll" : "aw-page-fixed"}`}>
        <WebContentContainer fill>
          <div className="aw-page-body">{children}</div>
        </WebContentContainer>
      </div>
      {bottomBar ? <div className="aw-page-bottom">{bottomBar}</div> : null}
    </div>
  );
}
