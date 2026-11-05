import React, { useEffect, useRef } from "react";
import { useLocale, type SupportedLocale } from "@nestyk/i18n";
import {
  MobileIcon,
  MobileNestykLogo,
  useMobileTheme,
  type AppIconName,
  type MobileModePageProps,
} from "@nestyk/ui/native";
import { WebContentContainer } from "@nestyk/ui/web-content";
import { isAgentComingSoonTab } from "@nestyk/ui/native";
import type { UserRole } from "@nestyk/types";
import type { AgentWorkspaceProps, WorkspaceNavItem } from "./AgentWorkspace.types";
import {
  AGENT_WEB_PRIMARY,
  AGENT_WEB_MORE,
  agentWebParent,
} from "./navigation";
import "./agent-workspace.css";
import { WebDialog, WebMenu } from "./ui";
import { AgentWorkspaceFooter } from "./AgentWorkspaceFooter";
import { passwordIsStrong } from "../../lib/auth/password-rules";
import { hcaptchaSiteKey } from "../../lib/auth/hcaptcha-site-key";
import { HcaptchaField } from "../../components/HcaptchaField";

const ROLES: UserRole[] = ["guest", "tenant", "landlord", "agent", "admin"];
/** Role colour shows only as a small dot (design W1); same values as tokens.colors.roles. */
const ROLE_DOT: Record<UserRole, string> = {
  guest: "#F8B615",
  tenant: "#00C68D",
  landlord: "#0055DA",
  agent: "#FF0052",
  admin: "#0F172A",
} as Record<UserRole, string>;
const ROLE_ICON: Record<UserRole, AppIconName> = {
  guest: "search",
  tenant: "home",
  landlord: "key",
  agent: "handshake",
  admin: "shield",
} as Record<UserRole, AppIconName>;

/** Small inline icons the app icon set does not have (web only). */
function PanelIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="M9 4v16" />
      <path d={collapsed ? "m13.5 10 2 2-2 2" : "m16 10-2 2 2 2"} />
    </svg>
  );
}
function SunIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </svg>
  );
}
function MoonIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
    </svg>
  );
}
function MonitorIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  );
}

/** Web-only theme choice (4 Nov 2026): "system" follows the device; stored in this browser only. */
type WebThemePref = "light" | "dark" | "system";
const THEME_PREF_KEY = "nestyk.web.theme";
function readThemePref(): WebThemePref {
  try {
    const value = typeof window === "undefined" ? null : window.localStorage.getItem(THEME_PREF_KEY);
    return value === "dark" || value === "system" ? value : "light";
  } catch {
    return "light";
  }
}

export function AgentWorkspace(props: AgentWorkspaceProps) {
  const { t, locale, setLocale } = useLocale();
  const { theme, isDark, setThemeMode } = useMobileTheme();
  const [collapsed, setCollapsed] = React.useState(false);
  const [themePref, setThemePref] = React.useState<WebThemePref>(readThemePref);
  /** Sidebar groups the user opened/closed; unset = open while it holds the current page. */
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const [notificationTab, setNotificationTab] = React.useState<
    "activity" | "messages"
  >("activity");
  const accountRef = useRef<HTMLDetailsElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [profileFirst, setProfileFirst] = React.useState("");
  const [profileLast, setProfileLast] = React.useState("");
  const [profilePhone, setProfilePhone] = React.useState("");
  const [profilePhoto, setProfilePhoto] = React.useState<File | null>(null);
  const [profileRemove, setProfileRemove] = React.useState(false);
  const [profileSaving, setProfileSaving] = React.useState(false);
  const [profileError, setProfileError] = React.useState<string | null>(null);
  const [profilePreview, setProfilePreview] = React.useState<string | null>(null);
  const [passwordOpen, setPasswordOpen] = React.useState(false);
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [passwordSaving, setPasswordSaving] = React.useState(false);
  const [passwordError, setPasswordError] = React.useState<string | null>(null);
  const [complete, setComplete] = React.useState<null | "profile" | "password">(null);
  const [captchaToken, setCaptchaToken] = React.useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = React.useState(0);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  // "Sign out of all devices" (Mos 4 Nov 2026): confirm first, keep the dialog open with the error if it fails.
  const [signOutAllOpen, setSignOutAllOpen] = React.useState(false);
  const [signOutAllBusy, setSignOutAllBusy] = React.useState(false);
  const [signOutAllError, setSignOutAllError] = React.useState<string | null>(null);
  const [accountMenuOpen, setAccountMenuOpen] = React.useState(false);
  const [deleteNowAvailable, setDeleteNowAvailable] = React.useState(false);
  const [deleteBlocked, setDeleteBlocked] = React.useState<string[] | null>(null);
  const [deleteScheduled, setDeleteScheduled] = React.useState<string | null>(null);
  const [deletePending, setDeletePending] = React.useState<"now" | "later" | "cancel" | null>(null);
  const deletePendingRef = React.useRef(deletePending);
  deletePendingRef.current = deletePending;
  const [deletePassword, setDeletePassword] = React.useState("");
  const [deletePasswordStep, setDeletePasswordStep] = React.useState(false);
  const deletePasswordStepRef = React.useRef(deletePasswordStep);
  deletePasswordStepRef.current = deletePasswordStep;
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = React.useState(false);
  const captchaRequired = hcaptchaSiteKey().length > 0;
  const copy = t.agent.dashboard.webWorkspace;
  const parent = agentWebParent(props.activeTab);

  useEffect(() => {
    if (!props.enabled) return;
    const closeAccount = (event: PointerEvent) => {
      if (deletePendingRef.current) return;
      if (
        event.target instanceof Node &&
        !accountRef.current?.contains(event.target)
      ) {
        accountRef.current?.removeAttribute("open");
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (deletePasswordStepRef.current) {
        setDeletePasswordStep(false);
        setDeletePassword("");
        return;
      }
      if (deletePendingRef.current) {
        setDeletePending(null);
        return;
      }
      if (accountRef.current?.open) {
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
    const account = accountRef.current;
    if (!props.enabled || !account) return;
    const onToggle = () => {
      if (account.open) return;
      setPasswordOpen(false);
      setProfileOpen(false);
      setDeleteOpen(false);
      setAccountMenuOpen(false);
      setPasswordError(null);
      setProfileError(null);
    };
    account.addEventListener("toggle", onToggle);
    return () => account.removeEventListener("toggle", onToggle);
  }, [props.enabled]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (props.enabled && props.notificationsOpen && dialog && !dialog.open)
      dialog.showModal();
    else if (dialog?.open) dialog.close();
  }, [props.enabled, props.notificationsOpen]);

  useEffect(() => {
    if (!props.enabled) return;
    if (themePref !== "system") {
      setThemeMode(themePref);
      return;
    }
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => setThemeMode(media.matches ? "dark" : "light");
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [props.enabled, themePref, setThemeMode]);


  if (!props.enabled)
    return <>{props.children}</>;

  const navigate = (tab: Parameters<AgentWorkspaceProps["onNavigate"]>[0]) => {
    accountRef.current?.removeAttribute("open");
    props.onNavigate(tab);
  };
  const chooseTheme = (pref: WebThemePref) => {
    setThemePref(pref);
    try {
      window.localStorage.setItem(THEME_PREF_KEY, pref);
    } catch {
      // private mode: keep the choice for this visit only
    }
  };
  const themeOptions: { key: WebThemePref; label: string }[] = [
    { key: "light", label: copy.themeLight },
    { key: "dark", label: copy.themeDark },
    { key: "system", label: copy.themeSystem },
  ];
  const menuLabel = (item: (typeof AGENT_WEB_PRIMARY)[number]) =>
    item.labelKey ? t.agent.dashboard[item.labelKey] : t.mobile.tabs[item.tab];
  const shellRole = props.activeRole ?? "agent";
  const canEditProfile = shellRole === "agent" && !!props.onSaveProfile;
  const canDeleteAccount = !!props.onLoadAccountDeletion && !!props.onDeleteAccount;
  const hasAccountActions = canEditProfile || !!props.onChangePassword || canDeleteAccount;
  const openProfile = () => {
    const parts = props.userName.trim().split(/\s+/).filter(Boolean);
    setProfileFirst(parts[0] ?? "");
    setProfileLast(parts.slice(1).join(" "));
    setProfilePhone(props.userPhone ?? "");
    setProfilePhoto(null);
    setProfileRemove(false);
    setProfilePreview(props.avatarUrl ?? null);
    setProfileError(null);
    setProfileOpen(true);
  };
  const saveProfile = async () => {
    if (!props.onSaveProfile || profileSaving) return;
    setProfileSaving(true);
    setProfileError(null);
    try {
      if (profileRemove) await props.onRemoveAvatar?.();
      else if (profilePhoto && props.onUploadAvatar) {
        await props.onUploadAvatar({
          uri: URL.createObjectURL(profilePhoto),
          name: profilePhoto.name,
          mimeType: profilePhoto.type || "image/jpeg",
          file: profilePhoto,
        });
      }
      await props.onSaveProfile({
        firstName: profileFirst.trim(),
        lastName: profileLast.trim(),
        phone: profilePhone.trim() ? profilePhone.trim() : null,
      });
      setProfileOpen(false);
      setPasswordOpen(false);
      setComplete("profile");
      accountRef.current?.removeAttribute("open");
    } catch (cause) {
      setProfileError(cause instanceof Error && cause.message ? cause.message : t.common.errorGeneric);
    } finally {
      setProfileSaving(false);
    }
  };
  const savePassword = async () => {
    if (!props.onChangePassword || passwordSaving) return;
    const copyPassword = t.mobile.account.password;
    if (!currentPassword) {
      setPasswordError(copyPassword.required);
      return;
    }
    if (!passwordIsStrong(newPassword)) {
      setPasswordError(t.mobile.auth.passwordRules);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(copyPassword.mismatch);
      return;
    }
    if (captchaRequired && !captchaToken) {
      setPasswordError(t.mobile.auth.captchaRequired);
      return;
    }
    setPasswordSaving(true);
    setPasswordError(null);
    try {
      await props.onChangePassword({
        currentPassword,
        newPassword,
        ...(captchaToken ? { captchaToken } : {}),
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordOpen(false);
      setComplete("password");
      accountRef.current?.removeAttribute("open");
    } catch (cause) {
      const code = cause && typeof cause === "object" && "code" in cause ? (cause as { code?: string }).code : undefined;
      setPasswordError(code === "WRONG_PASSWORD" ? copyPassword.incorrect : code === "WEAK_PASSWORD" ? t.mobile.auth.passwordRules : cause instanceof Error && cause.message ? cause.message : t.common.errorGeneric);
    } finally {
      setCaptchaToken(null);
      setCaptchaKey(captchaKey + 1);
      setPasswordSaving(false);
    }
  };
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
  const navItem = (item: (typeof AGENT_WEB_PRIMARY)[number]) =>
    isAgentComingSoonTab(item.tab) ? (
      <button
        key={item.tab}
        type="button"
        className="aw-nav-item"
        disabled
        title={`${menuLabel(item)} · ${t.agent.dashboard.comingSoon}`}
      >
        <MobileIcon name={item.icon} size={20} color={theme.textSecondary} />
        <span className="aw-nav-label">{menuLabel(item)}</span>
        <span className="aw-soon aw-nav-label">{t.agent.dashboard.comingSoon}</span>
      </button>
    ) : (
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

  const listingOpen = expanded.listing ?? parent === "listingRoom";
  const tenantsOpen = expanded.tenants ?? parent === "clients";
  const toggleGroup = (id: "listing" | "tenants", open: boolean, first: () => void) => {
    if (collapsed) {
      first();
      return;
    }
    setExpanded({ ...expanded, [id]: !open });
  };
  const subItem = (id: string, label: string, active: boolean, onPress: () => void) => (
    <button
      key={id}
      type="button"
      className={`aw-nav-subitem ${active ? "is-active" : ""}`}
      aria-current={active ? "page" : undefined}
      disabled={props.navigationDisabled}
      onClick={() => {
        accountRef.current?.removeAttribute("open");
        onPress();
      }}
    >
      {label}
    </button>
  );
  const groupItem = (
    id: "listing" | "tenants",
    icon: AppIconName,
    label: string,
    tab: "listingRoom" | "clients",
    open: boolean,
    subs: React.ReactNode,
  ) => (
    <React.Fragment key={id}>
      <button
        type="button"
        className={`aw-nav-item ${parent === tab ? "is-active" : ""}`}
        aria-expanded={collapsed ? undefined : open}
        disabled={props.navigationDisabled}
        title={label}
        onClick={() => toggleGroup(id, open, () => navigate(tab))}
      >
        <MobileIcon name={icon} size={20} color={itemColor(parent === tab)} />
        <span className="aw-nav-label">{label}</span>
        <span className="aw-nav-chev" aria-hidden="true">
          <MobileIcon name="chevron-right" size={14} color={theme.textSecondary} />
        </span>
      </button>
      {open && !collapsed ? <div className="aw-nav-sub">{subs}</div> : null}
    </React.Fragment>
  );
  const soonItem = (key: string, icon: AppIconName, label: string) => (
    <button
      key={key}
      type="button"
      className="aw-nav-item"
      disabled
      title={`${label} · ${t.agent.dashboard.comingSoon}`}
    >
      <MobileIcon name={icon} size={20} color={theme.textSecondary} />
      <span className="aw-nav-label">{label}</span>
      <span className="aw-soon aw-nav-label">{t.agent.dashboard.comingSoon}</span>
    </button>
  );
  const creatingTenant = props.creating === "tenant";
  const agentTitle = () => {
    switch (props.activeTab) {
      case "listingRoom":
        return t.mobile.drawerMenu.listingRoom;
      case "createListing":
        return t.agent.dashboard.addListing;
      case "listingLead":
        return t.mobile.drawerMenu.listingLead;
      case "clients":
        return creatingTenant ? t.agent.tenants.create : t.mobile.drawerMenu.clients;
      default:
        return currentMenu ? menuLabel(currentMenu) : t.mobile.tabs[props.activeTab];
    }
  };
  const pageTitle =
    (customCurrent ? customCurrent.label : props.navSections ? t.mobile.tabs[props.activeTab] : agentTitle()) ||
    workspaceLabel;
  const switchRoles = ROLES.filter(
    (role) => !props.allowedRoles || props.allowedRoles.includes(role) || role === shellRole,
  );
  const create = props.onCreate;

  return (
      <div
        className={`aw-shell${collapsed ? " aw-collapsed" : ""}`}
        data-theme={theme.mode}
        lang={locale}
        style={
          {
            "--aw-bg": isDark ? theme.background : "#F3F5F8",
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
        <header className="aw-topbar">
          <div className="aw-logo-cell">
            <button
              className="aw-brand"
              type="button"
              onClick={() => navigate("dashboard")}
              disabled={props.navigationDisabled}
              aria-label={`NESTYK ${t.mobile.tabs.dashboard}`}
            >
              <div className="aw-logo-wide">
                <MobileNestykLogo variant={isDark ? "wordmarkOnDark" : "wordmark"} height={30} />
              </div>
              <div className="aw-logo-compact">
                <MobileNestykLogo variant="markSecondary" height={32} />
              </div>
            </button>
          </div>
          <div className="aw-topbar-main">
            <button
              type="button"
              className="aw-collapse"
              data-testid="shell.sidebarToggle"
              onClick={() => setCollapsed(!collapsed)}
              aria-label={collapsed ? copy.expand : copy.collapse}
              aria-expanded={!collapsed}
              title={collapsed ? copy.expand : copy.collapse}
            >
              <PanelIcon collapsed={collapsed} />
            </button>
            <h1 className="aw-title">{pageTitle}</h1>
            <div className="aw-topbar-actions">
              {create ? (
                <WebMenu
                  label={copy.create}
                  testID="shell.create"
                  triggerClassName="aw-create"
                  trigger={
                    <>
                      <MobileIcon name="plus" size={17} color={isDark ? "#211E1E" : "#FFFFFF"} />
                      <span className="aw-create-label">{copy.create}</span>
                    </>
                  }
                  items={[
                    { key: "room", icon: "buildings", label: t.agent.dashboard.addListing, disabled: props.navigationDisabled, onSelect: () => create("room") },
                    { key: "lead", icon: "clipboard", label: t.agent.dashboard.newLead, disabled: props.navigationDisabled, onSelect: () => create("lead") },
                    { key: "tenant", icon: "user-plus", label: t.agent.tenants.create, disabled: props.navigationDisabled, onSelect: () => create("tenant") },
                  ]}
                />
              ) : null}
              <WebMenu
                label={t.mobile.settings.language}
                testID="shell.language"
                triggerClassName="aw-lang"
                trigger={
                  <>
                    <MobileIcon name="globe" size={17} color={theme.screenTitle} />
                    <span>{locale.toUpperCase()}</span>
                    <MobileIcon name="chevron-down" size={13} color={theme.textSecondary} />
                  </>
                }
                items={Object.entries(t.mobile.settings.languageNames).map(([key, label]) => ({
                  key,
                  label,
                  checked: key === locale,
                  onSelect: () => setLocale(key as SupportedLocale),
                }))}
              />
              <WebMenu
                label={`${copy.theme}: ${themeOptions.find((option) => option.key === themePref)?.label ?? ""}`}
                testID="shell.theme"
                triggerClassName="aw-icon-button aw-theme-button"
                trigger={themePref === "system" ? <MonitorIcon /> : themePref === "dark" ? <MoonIcon /> : <SunIcon />}
                items={themeOptions.map((option) => ({
                  key: option.key,
                  label: option.label,
                  checked: option.key === themePref,
                  testID: `shell.theme.${option.key}`,
                  onSelect: () => chooseTheme(option.key),
                }))}
              />
              <button
                className="aw-icon-button aw-notification-button"
                type="button"
                onClick={props.onNotificationsOpen}
                aria-label={`${t.mobile.notifications.title}${props.notificationCount ? ` (${props.notificationCount})` : ""}`}
              >
                <MobileIcon name="bell" size={21} color={theme.screenTitle} />
                {props.notificationCount > 0 ? <span className="aw-notification-dot" /> : null}
              </button>
            </div>
          </div>
        </header>
        <aside className="aw-sidebar" aria-label={t.mobile.profile.navigation}>
          <div className="aw-switch">
            <WebMenu
              label={copy.switchWorkspace}
              testID="shell.workspace"
              align="start"
              triggerClassName="aw-switcher"
              trigger={
                <>
                  <span className="aw-switch-tile" aria-hidden="true">
                    <MobileIcon name={ROLE_ICON[shellRole] ?? "user"} size={18} color="#583C0A" />
                    <span className="aw-switch-dot" style={{ "--aw-role": ROLE_DOT[shellRole] } as React.CSSProperties} />
                  </span>
                  <span className="aw-switch-copy">
                    <strong>{t.roles[shellRole]}</strong>
                    <small>{workspaceLabel}</small>
                  </span>
                  <span className="aw-switch-chev" aria-hidden="true">
                    <MobileIcon name="chevron-down" size={14} color={theme.textSecondary} />
                  </span>
                </>
              }
              items={[
                ...switchRoles.map((role) => ({
                  key: role,
                  label: t.roles[role],
                  icon: ROLE_ICON[role] ?? ("user" as AppIconName),
                  checked: role === shellRole,
                  disabled: props.navigationDisabled,
                  badge: props.otherSiteRoles?.includes(role) ? t.webSession.otherSite : undefined,
                  testID: `shell.workspace.${role}`,
                  onSelect: () => {
                    accountRef.current?.removeAttribute("open");
                    if (role !== shellRole) props.onRoleChange(role);
                  },
                })),
                { key: "add", label: copy.addWorkspace, icon: "plus" as AppIconName, disabled: true, badge: t.agent.dashboard.comingSoon },
                { key: "manage", label: copy.manageWorkspace, icon: "gear" as AppIconName, disabled: true, badge: t.agent.dashboard.comingSoon },
              ]}
            />
          </div>
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
                <p className="aw-nav-caption">{copy.menu}</p>
                <nav className="aw-nav" aria-label={copy.menu}>
                  {navItem(AGENT_WEB_PRIMARY[0])}
                  {groupItem("listing", "buildings", t.mobile.drawerMenu.listing, "listingRoom", listingOpen, [
                    subItem("rooms", t.mobile.drawerMenu.listingRoom, props.activeTab === "listingRoom", () => navigate("listingRoom")),
                    subItem("add", t.agent.dashboard.addListing, props.activeTab === "createListing", () => (create ? create("room") : navigate("createListing"))),
                  ])}
                  {navItem(AGENT_WEB_PRIMARY[2])}
                  {groupItem("tenants", "handshake", t.mobile.drawerMenu.clients, "clients", tenantsOpen, [
                    subItem("list", t.agent.tenants.list.tabAll, parent === "clients" && !creatingTenant, () => navigate("clients")),
                    ...(create ? [subItem("create", t.agent.tenants.create, creatingTenant, () => create("tenant"))] : []),
                  ])}
                </nav>
                <div className="aw-nav-divider" />
                <p className="aw-nav-caption">{t.mobile.tabs.more}</p>
                <nav className="aw-nav" aria-label={t.mobile.tabs.more}>
                  {AGENT_WEB_MORE.map(navItem)}
                </nav>
                <div className="aw-nav-divider" />
                <p className="aw-nav-caption">{t.agent.dashboard.financeSection}</p>
                <nav className="aw-nav" aria-label={t.agent.dashboard.financeSection}>
                  {soonItem("commission", "wallet", t.mobile.drawerMenu.commission)}
                </nav>
                <div className="aw-nav-divider" />
                <p className="aw-nav-caption">{copy.main}</p>
                <nav className="aw-nav" aria-label={copy.main}>
                  {soonItem("team", "users", copy.team)}
                </nav>
              </>
            )}
          </div>
          <details className="aw-account" ref={accountRef}>
                  <summary aria-label={copy.account}>
                    {props.avatarUrl ? (
                      <img className="aw-avatar aw-avatar-photo" src={props.avatarUrl} alt="" />
                    ) : (
                      <span className="aw-avatar">{props.initials}</span>
                    )}
                    <span className="aw-account-text">
                      <strong>{props.userName}</strong>
                      <small>{props.userEmail || t.roles[shellRole]}</small>
                    </span>
                    <span className="aw-account-chev">
                      <MobileIcon name="chevron-down" size={14} color={theme.textSecondary} />
                    </span>
                  </summary>
                  <div className={passwordOpen ? "aw-account-popover aw-account-popover-password" : "aw-account-popover"}>
                    <div className="aw-account-info">
                      <strong>{props.userName}</strong>
                      <span>{props.userEmail}</span>
                    </div>
                    {shellRole === "agent" && props.onSaveProfile && profileOpen ? (
                      <form
                        className="aw-profile-form"
                        onSubmit={(event) => {
                          event.preventDefault();
                          return saveProfile();
                        }}
                      >
                        <div className="aw-photo">
                          <label className="aw-photo-hit">
                            <span className="aw-photo-sr">{t.mobile.account.changePhoto}</span>
                            {profilePreview ? (
                              <img className="aw-photo-face" src={profilePreview} alt="" />
                            ) : (
                              <span className="aw-photo-face" aria-hidden="true">{props.initials}</span>
                            )}
                            <span className="aw-photo-badge" aria-hidden="true">
                              <MobileIcon name="camera" size={14} color="#211E1E" />
                            </span>
                            <input
                              className="aw-photo-file"
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              onChange={(event) => {
                                const file = event.target.files?.[0] ?? null;
                                setProfilePhoto(file);
                                setProfileRemove(false);
                                setProfilePreview(file ? URL.createObjectURL(file) : props.avatarUrl ?? null);
                              }}
                            />
                          </label>
                          <div className="aw-photo-copy">
                            <span className="aw-photo-title">{t.mobile.account.changePhoto}</span>
                            <span className="aw-photo-hint">{t.mobile.account.chooseFromLibrary}</span>
                            {profilePreview ? (
                              <button
                                type="button"
                                className="aw-photo-remove"
                                onClick={() => {
                                  setProfilePhoto(null);
                                  setProfileRemove(true);
                                  setProfilePreview(null);
                                }}
                              >
                                {t.mobile.account.removePhoto}
                              </button>
                            ) : null}
                          </div>
                        </div>
                        <label>
                          {t.mobile.account.firstName}
                          <input value={profileFirst} onChange={(event) => setProfileFirst(event.target.value)} autoComplete="given-name" />
                        </label>
                        <label>
                          {t.mobile.account.lastName}
                          <input value={profileLast} onChange={(event) => setProfileLast(event.target.value)} autoComplete="family-name" />
                        </label>
                        <label>
                          {t.mobile.account.phone}
                          <input value={profilePhone} onChange={(event) => setProfilePhone(event.target.value)} autoComplete="tel" inputMode="tel" />
                        </label>
                        {profileError ? <p className="aw-profile-error" role="alert">{profileError}</p> : null}
                        <button type="submit" className="aw-button aw-button-primary" disabled={profileSaving}>
                          {profileSaving ? t.common.loading : t.common.save}
                        </button>
                        <button type="button" className="aw-button aw-button-secondary" disabled={profileSaving} onClick={() => setProfileOpen(false)}>
                          {t.common.cancel}
                        </button>
                      </form>
                    ) : null}
                    {props.onChangePassword && passwordOpen ? (
                      <form
                        className="aw-profile-form"
                        onSubmit={(event) => {
                          event.preventDefault();
                          return savePassword();
                        }}
                      >
                        <p className="aw-photo-hint">{t.mobile.auth.passwordRules}</p>
                        <label>
                          {t.mobile.account.password.current}
                          <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" />
                        </label>
                        <label>
                          {t.mobile.account.password.new}
                          <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" />
                        </label>
                        <label>
                          {t.mobile.account.password.confirm}
                          <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" />
                        </label>
                        {captchaRequired ? <HcaptchaField resetKey={captchaKey} onToken={setCaptchaToken} /> : null}
                        {passwordError ? <p className="aw-profile-error" role="alert">{passwordError}</p> : null}
                        <button type="submit" className="aw-button aw-button-primary" disabled={passwordSaving}>
                          {passwordSaving ? t.common.loading : t.mobile.account.password.submit}
                        </button>
                        <button type="button" className="aw-button aw-button-secondary" disabled={passwordSaving} onClick={() => setPasswordOpen(false)}>
                          {t.common.cancel}
                        </button>
                      </form>
                    ) : null}
                    {hasAccountActions && !profileOpen && !passwordOpen && !deleteOpen ? (
                      accountMenuOpen ? (
                        <>
                        {canEditProfile ? (
                          <button type="button" className="aw-button aw-button-secondary" onClick={openProfile}>
                            {t.mobile.account.editProfile}
                          </button>
                        ) : null}
                        {props.onChangePassword ? (
                          <button type="button" className="aw-button aw-button-secondary" onClick={() => { setPasswordError(null); setPasswordOpen(true); }}>
                            {t.mobile.account.changePassword}
                          </button>
                        ) : null}
                        {canDeleteAccount ? (
                          <button type="button" className="aw-button aw-button-secondary" onClick={() => {
                            setDeleteError(null);
                            setDeleteBlocked(null);
                            setDeleteOpen(true);
                            void props.onLoadAccountDeletion!().then((preview) => {
                              setDeleteBlocked(preview.blocked ? preview.reasons : []);
                              setDeleteScheduled(preview.scheduledFor);
                              setDeleteNowAvailable(preview.deleteNowAvailable === true);
                              setDeletePending(null);
                            }).catch((cause: unknown) => {
                              setDeleteError(cause instanceof Error && cause.message ? cause.message : t.common.errorGeneric);
                            });
                          }}>
                            {t.mobile.account.deleteAccount}
                          </button>
                        ) : null}
                        <button type="button" className="aw-button aw-button-secondary" onClick={() => setAccountMenuOpen(false)}>
                          {t.common.cancel}
                        </button>
                        </>
                      ) : (
                        <button type="button" className="aw-button aw-button-secondary" onClick={() => setAccountMenuOpen(true)}>
                          {t.mobile.account.manageAccount}
                        </button>
                      )
                    ) : null}
                    {profileOpen || passwordOpen ? null : <>
                    {deleteOpen ? (
                      <div className="aw-profile-form">
                        <p className="aw-photo-hint">{t.mobile.account.deleteAccountBody}</p>
                        {deleteBlocked && deleteBlocked.length > 0 ? (
                          <>
                            <p className="aw-profile-error">{t.mobile.account.deleteAccountBlocked}</p>
                            {deleteBlocked.map((reason) => (
                              <p key={reason} className="aw-profile-error">{t.mobile.account.deleteAccountReasons[reason as 'open_contract' | 'open_agent_contract' | 'unpaid_bill' | 'bill_awaiting_review' | 'unrefunded_deposit']}</p>
                            ))}
                          </>
                        ) : null}
                        {deleteScheduled ? <p className="aw-photo-hint">{t.mobile.account.deleteAccountScheduled.replace("{date}", new Date(deleteScheduled).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Bangkok" }))}</p> : null}
                        {deleteError ? <p className="aw-profile-error" role="alert">{deleteError}</p> : null}
                        {!deleteBlocked?.length && !deleteScheduled ? (
                          <>
                            {deleteNowAvailable ? <button type="button" className="aw-button aw-button-primary" disabled={deleteBusy || deleteBlocked === null} onClick={() => setDeletePending('now')}>{t.mobile.account.deleteAccountNow}</button> : null}
                            <button type="button" className="aw-button aw-button-secondary" disabled={deleteBusy || deleteBlocked === null} onClick={() => setDeletePending('later')}>{t.mobile.account.deleteAccountLater}</button>
                          </>
                        ) : null}
                        {deleteScheduled && props.onCancelAccountDeletion ? (
                          <button type="button" className="aw-button aw-button-secondary" disabled={deleteBusy} onClick={() => {
                            setDeleteError(null);
                            setDeletePasswordStep(false);
                            setDeletePending("cancel");
                          }}>{t.mobile.account.deleteAccountCancel}</button>
                        ) : null}
                        <button type="button" className="aw-button aw-button-secondary" disabled={deleteBusy} onClick={() => { setDeleteOpen(false); setDeletePending(null); }}>
                          {t.common.cancel}
                        </button>
                      </div>
                    ) : null}
                    <button
                      type="button"
                      className="aw-signout"
                      disabled={props.navigationDisabled}
                      onClick={props.onSignOut}
                    >
                      {t.common.signOut}
                    </button>
                    {props.onSignOutEverywhere ? (
                      <button
                        type="button"
                        className="aw-signout aw-signout-all"
                        disabled={props.navigationDisabled}
                        data-testid="account.signOutAll"
                        onClick={() => {
                          setSignOutAllError(null);
                          setSignOutAllOpen(true);
                        }}
                      >
                        {t.webSession.signOutAll}
                      </button>
                    ) : null}
                    </>}
                  </div>
                </details>
        </aside>

          <main id="agent-web-main" className="aw-main" tabIndex={-1}>
            {props.children}
          </main>
        <WebDialog
          open={signOutAllOpen}
          title={t.webSession.signOutAllTitle}
          description={t.webSession.signOutAllBody}
          size="sm"
          testID="account.signOutAllDialog"
          onClose={() => {
            if (!signOutAllBusy) setSignOutAllOpen(false);
          }}
          footer={
            <>
              <button type="button" className="aw-button aw-button-secondary" disabled={signOutAllBusy} onClick={() => setSignOutAllOpen(false)}>
                {t.common.cancel}
              </button>
              <button
                type="button"
                className="aw-button aw-button-primary"
                disabled={signOutAllBusy}
                data-testid="account.signOutAllConfirm"
                onClick={async () => {
                  if (!props.onSignOutEverywhere) return;
                  setSignOutAllBusy(true);
                  setSignOutAllError(null);
                  try {
                    await props.onSignOutEverywhere();
                    setSignOutAllOpen(false);
                  } catch {
                    setSignOutAllError(t.webSession.signOutAllFailed);
                  } finally {
                    setSignOutAllBusy(false);
                  }
                }}
              >
                {t.webSession.signOutAllConfirm}
              </button>
            </>
          }
        >
          {signOutAllError ? <p className="aw-profile-error" role="alert">{signOutAllError}</p> : null}
        </WebDialog>
        {complete ? (
          <div className="aw-complete" role="dialog" aria-modal="true" aria-labelledby="aw-complete-title">
            <div className="aw-complete-card">
              <div className="aw-complete-badge" aria-hidden="true">
                <MobileIcon name="check" size={28} color="#211E1E" weight="bold" />
              </div>
              <h2 id="aw-complete-title">
                {complete === "password" ? t.mobile.account.changePassword : t.mobile.account.editProfile}
              </h2>
              <p>{complete === "password" ? t.mobile.account.password.updated : t.mobile.account.profileSaved}</p>
              <button type="button" className="aw-button aw-button-primary" onClick={() => {
                const returnToOverview = complete === "password";
                setComplete(null);
                if (returnToOverview) navigate("dashboard");
              }}>
                {t.mobile.account.done}
              </button>
            </div>
          </div>
        ) : null}
        {deletePending ? (
          <div
            className="aw-complete"
            role="dialog"
            aria-modal="true"
            aria-labelledby="aw-delete-title"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="aw-complete-card">
              <h2 id="aw-delete-title">{deletePending === "cancel" ? t.mobile.account.deleteAccountCancel : t.mobile.account.deleteAccountConfirm}</h2>
              <p>
                {deletePasswordStep
                  ? t.mobile.account.deleteAccountPasswordPrompt
                  : deletePending === "cancel"
                    ? t.mobile.account.deleteAccountCancelConfirm
                    : deletePending === "now"
                      ? t.mobile.account.deleteAccountConfirmNow
                      : t.mobile.account.deleteAccountConfirmLater}
              </p>
              {deletePasswordStep ? (
                <label className="aw-profile-form">
                  {t.mobile.account.password.current}
                  <input
                    type="password"
                    value={deletePassword}
                    onChange={(event) => setDeletePassword(event.target.value)}
                    autoComplete="current-password"
                  />
                </label>
              ) : null}
              {deletePasswordStep && captchaRequired ? <HcaptchaField resetKey={captchaKey} onToken={setCaptchaToken} /> : null}
              {deleteError ? <p className="aw-profile-error" role="alert">{deleteError}</p> : null}
              <div className="aw-confirm-actions">
                <button
                  type="button"
                  className={deletePending === "cancel" ? "aw-button aw-button-primary" : "aw-button aw-button-danger"}
                  disabled={deleteBusy}
                  onClick={() => {
                    const choice = deletePending;
                    if (!choice) return;
                    if (choice !== "cancel" && !deletePasswordStep) {
                      setDeleteError(null);
                      setDeletePassword("");
                      setCaptchaToken(null);
                      setCaptchaKey((key) => key + 1);
                      setDeletePasswordStep(true);
                      return;
                    }
                    if (choice !== "cancel") {
                      if (!deletePassword) {
                        setDeleteError(t.mobile.account.password.required);
                        return;
                      }
                      if (captchaRequired && !captchaToken) {
                        setDeleteError(t.mobile.auth.captchaRequired);
                        return;
                      }
                    }
                    const proof = { password: deletePassword, ...(captchaToken ? { captchaToken } : {}) };
                    const result = choice === "now"
                      ? props.onDeleteAccount?.(proof)
                      : choice === "later"
                        ? props.onScheduleAccountDeletion?.(proof)
                        : props.onCancelAccountDeletion?.();
                    if (!result) return;
                    setDeleteBusy(true);
                    setDeleteError(null);
                    void result.then(() => {
                      setDeletePending(null);
                      setDeletePasswordStep(false);
                      setDeletePassword("");
                      setDeleteOpen(false);
                      setDeleteBusy(false);
                      if (choice === "cancel") setDeleteScheduled(null);
                      if (choice === "later") navigate("dashboard");
                    }).catch((cause: unknown) => {
                      const code = cause && typeof cause === "object" && "code" in cause ? String((cause as { code: unknown }).code) : "";
                      if (code === "REAUTH_REQUIRED") {
                        // More than 5 minutes since the password was confirmed: ask for it again (QA A).
                        setDeletePassword("");
                        setDeletePasswordStep(true);
                        setDeleteError(t.mobile.account.deleteAccountReauth);
                      } else if (code === "ACCOUNT_DELETE_BLOCKED" && props.onLoadAccountDeletion) {
                        // QA B10: something new blocks deletion since the panel opened: show the fresh reasons.
                        setDeletePending(null);
                        setDeletePasswordStep(false);
                        setDeletePassword("");
                        setDeleteError(null);
                        void props.onLoadAccountDeletion().then((preview) => {
                          setDeleteBlocked(preview.blocked ? preview.reasons : []);
                          setDeleteScheduled(preview.scheduledFor);
                            setDeleteNowAvailable(preview.deleteNowAvailable === true);
                        }).catch(() => setDeleteError(t.common.errorGeneric));
                      } else {
                        setDeleteError(code === "WRONG_PASSWORD" ? t.mobile.account.password.incorrect : cause instanceof Error && cause.message ? cause.message : t.common.errorGeneric);
                      }
                      setCaptchaToken(null);
                      setCaptchaKey((key) => key + 1);
                      setDeleteBusy(false);
                    });
                  }}
                >
                  {deleteBusy ? t.common.loading : t.common.confirm}
                </button>
                <button type="button" className="aw-button aw-button-secondary" disabled={deleteBusy} onClick={() => { setDeletePending(null); setDeletePasswordStep(false); setDeletePassword(""); setDeleteError(null); }}>
                  {t.common.cancel}
                </button>
              </div>
            </div>
          </div>
        ) : null}
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
              <p className="aw-notification-empty">{props.notificationsEmptyLabel ?? t.common.noData}</p>
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
  // No refresh button on the web (Mos 4 Nov 2026, D4): pages load fresh data when opened; the browser reload works too.
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
          {/* F1 footer (footer plan): scrolls with the page; left out on forms with a fixed action bar. */}
          {scrollable && !bottomBar ? (
            <AgentWorkspaceFooter page={typeof window === "undefined" ? undefined : window.location.pathname} />
          ) : null}
        </WebContentContainer>
      </div>
      {bottomBar ? <div className="aw-page-bottom">{bottomBar}</div> : null}
    </div>
  );
}
