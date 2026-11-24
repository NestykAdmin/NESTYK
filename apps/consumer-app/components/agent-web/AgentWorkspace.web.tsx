import React, { useEffect, useRef } from "react";
import { dateLocale, useLocale, type SupportedLocale } from "@nestyk/i18n";
import {
  MobileIcon,
  MobileNestykLogo,
  roleTileColors,
  useMobileTheme,
  type AppIconName,
  type MobileModePageProps,
} from "@nestyk/ui/native";
import { WebContentContainer } from "@nestyk/ui/web-content";
import { isAgentComingSoonTab } from "@nestyk/ui/native";
import { COOKIE_SETTINGS_HREF, cookieConsentAllows } from "@nestyk/ui/cookie-consent";
import type { UserRole } from "@nestyk/types";
import type { AgentWorkspaceProps, WorkspaceNavItem } from "./AgentWorkspace.types";
import type { SettingsSection } from "../../lib/app-routes";
import {
  AGENT_WEB_PRIMARY,
  AGENT_WEB_MORE,
  agentWebPageWidth,
  agentWebParent,
} from "./navigation";
import "./agent-workspace.css";
import { WebDialog, WebMenu } from "./ui";
import { AgentWorkspaceFooter } from "./AgentWorkspaceFooter";
import { passwordIsStrong } from "../../lib/auth/password-rules";
import { captchaSiteKey } from "../../lib/auth/captcha-site-key";
import { CaptchaField } from "../../components/CaptchaField";
import { legalHref } from "../../lib/legal-footer";

const ROLES: UserRole[] = ["guest", "tenant", "landlord", "agent", "self_owner", "admin"];
const ROLE_ICON: Record<UserRole, AppIconName> = {
  guest: "search",
  tenant: "home",
  landlord: "key",
  agent: "handshake",
  admin: "shield",
  self_owner: "house-plus",
};

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

/** Shown on the settings page; same value as the app's account settings (MobileAccountSettingsBody). */
const APP_VERSION = "0.1.0";

/** Settings page sections in menu order (Mos 18 Nov 2026); no notifications section yet. */
const SETTINGS_NAV: { key: SettingsSection; icon: AppIconName }[] = [
  { key: "profile", icon: "user" },
  { key: "security", icon: "shield" },
  { key: "display", icon: "sliders" },
  { key: "help", icon: "info" },
];

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

/** Layout effect in the browser (runs before paint); plain effect where there is no window. */
const useBeforePaint = typeof window === "undefined" ? useEffect : React.useLayoutEffect;

export function AgentWorkspace(props: AgentWorkspaceProps) {
  const { t, locale, setLocale } = useLocale();
  const { theme, isDark, setThemeMode } = useMobileTheme();
  const [collapsed, setCollapsed] = React.useState(false);
  // W4 layout ก (Mos 17 Nov 2026): the create-tenant page folds the menu to icons so the steps rail and the form
  // have room; the user can still open it there, and leaving the page brings back their own setting.
  const formCompact = props.creating === "tenant" && !props.settingsSection;
  const [formMenuOpen, setFormMenuOpen] = React.useState(false);
  useEffect(() => {
    if (!formCompact) setFormMenuOpen(false);
  }, [formCompact]);
  const isCollapsed = formCompact ? !formMenuOpen : collapsed;
  const [themePref, setThemePref] = React.useState<WebThemePref>(readThemePref);
  /** Sidebar groups the user opened/closed; unset = open while it holds the current page. */
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const [notificationTab, setNotificationTab] = React.useState<
    "activity" | "messages"
  >("activity");
  const accountRef = useRef<HTMLDetailsElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Profile fields on the settings page: null = not edited yet, so the field shows the saved value.
  const [profileFirst, setProfileFirst] = React.useState<string | null>(null);
  const [profileLast, setProfileLast] = React.useState<string | null>(null);
  const [profilePhone, setProfilePhone] = React.useState<string | null>(null);
  const [profilePhoto, setProfilePhoto] = React.useState<File | null>(null);
  const [profileRemove, setProfileRemove] = React.useState(false);
  const [profileSaving, setProfileSaving] = React.useState(false);
  const [profileError, setProfileError] = React.useState<string | null>(null);
  const [profilePreview, setProfilePreview] = React.useState<string | null>(null);
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
  /** Account menu, design จ2 (18 Nov 2026): the role row opens the role list inside the same menu. */
  const [rolePickerOpen, setRolePickerOpen] = React.useState(false);
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
  const captchaRequired = captchaSiteKey().length > 0;
  const copy = t.agent.dashboard.webWorkspace;
  const settingsSection = props.settingsSection ?? null;
  const settingsOpen = settingsSection !== null;
  // The settings page is not a sidebar page: nothing in the menu is marked while it is open.
  const parent = settingsOpen ? null : agentWebParent(props.activeTab);

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
      setRolePickerOpen(false);
    };
    account.addEventListener("toggle", onToggle);
    return () => account.removeEventListener("toggle", onToggle);
  }, [props.enabled]);

  // Moving to another section or leaving the settings page drops unsaved edits.
  useEffect(() => {
    setProfileFirst(null);
    setProfileLast(null);
    setProfilePhone(null);
    setProfilePhoto(null);
    setProfileRemove(false);
    setProfilePreview(null);
    setProfileError(null);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError(null);
    setDeleteOpen(false);
  }, [settingsSection]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (props.enabled && props.notificationsOpen && dialog && !dialog.open)
      dialog.showModal();
    else if (dialog?.open) dialog.close();
  }, [props.enabled, props.notificationsOpen]);

  // D3 (13 Nov 2026): apply the saved theme before the browser paints, so a dark reload shows no light frame.
  useBeforePaint(() => {
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
    props.onCloseSettings?.();
    props.onNavigate(tab);
  };
  const chooseTheme = (pref: WebThemePref) => {
    setThemePref(pref);
    // PDPA cookie consent: remembered only when "Remember my settings" is allowed.
    if (!cookieConsentAllows("preferences")) return;
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
  // Agent, admin and self owner edit their profile on the web; tenant and landlord edit it in the app for now.
  const canEditProfile = (shellRole === "agent" || shellRole === "admin" || shellRole === "self_owner") && !!props.onSaveProfile;
  const canDeleteAccount = !!props.onLoadAccountDeletion && !!props.onDeleteAccount;
  const nameParts = props.userName.trim().split(/\s+/).filter(Boolean);
  const firstValue = profileFirst ?? nameParts[0] ?? "";
  const lastValue = profileLast ?? nameParts.slice(1).join(" ");
  const phoneValue = profilePhone ?? props.userPhone ?? "";
  const previewValue = profileRemove ? null : profilePreview ?? props.avatarUrl ?? null;
  const profileDirty =
    firstValue !== (nameParts[0] ?? "") ||
    lastValue !== nameParts.slice(1).join(" ") ||
    phoneValue !== (props.userPhone ?? "") ||
    !!profilePhoto ||
    profileRemove;
  const resetProfile = () => {
    setProfileFirst(null);
    setProfileLast(null);
    setProfilePhone(null);
    setProfilePhoto(null);
    setProfileRemove(false);
    setProfilePreview(null);
    setProfileError(null);
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
        firstName: firstValue.trim(),
        lastName: lastValue.trim(),
        phone: phoneValue.trim() ? phoneValue.trim() : null,
      });
      resetProfile();
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
  // Selected item (design ก, Mos 17 Nov 2026): slate fill + yellow bar in light, lifted grey + yellow bar in dark.
  // Its icon is dark gold on the light fill (CI yellow is too faint there) and CI yellow in dark mode;
  // other icons are slate 700 / the dark body step #E2E8F0 (v1.2 B+C) so they no longer look faded.
  const itemColor = (active: boolean) =>
    active ? (isDark ? "#F8B615" : "#795719") : isDark ? "#E2E8F0" : "#334155";
  const customItem = (item: WorkspaceNavItem) => (
    <button
      key={item.id}
      type="button"
      className={`aw-nav-item ${item.active && !settingsOpen ? "is-active" : ""}`}
      aria-current={item.active && !settingsOpen ? "page" : undefined}
      disabled={props.navigationDisabled || item.disabled}
      title={item.title ?? item.label}
      aria-label={item.count && item.countLabel ? `${item.label}, ${item.countLabel}` : undefined}
      onClick={() => {
        if (props.navigationDisabled || item.disabled) return;
        accountRef.current?.removeAttribute("open");
        props.onCloseSettings?.();
        item.onPress();
      }}
    >
      <MobileIcon name={item.icon} size={20} color={itemColor(Boolean(item.active) && !settingsOpen)} />
      <span className="aw-nav-label">{item.label}</span>
      {item.badge ? <span className="aw-soon aw-nav-label">{item.badge}</span> : null}
      {item.count ? <span className="aw-nav-count">{item.count > 99 ? "99+" : item.count}</span> : null}
      {item.active && !settingsOpen ? <span className="aw-active-dot" /> : null}
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
    if (isCollapsed) {
      first();
      return;
    }
    setExpanded({ ...expanded, [id]: !open });
  };
  const subItem = (id: string, label: string, active: boolean, onPress: () => void) => (
    <button
      key={id}
      type="button"
      className={`aw-nav-subitem ${active && !settingsOpen ? "is-active" : ""}`}
      aria-current={active && !settingsOpen ? "page" : undefined}
      disabled={props.navigationDisabled}
      onClick={() => {
        accountRef.current?.removeAttribute("open");
        props.onCloseSettings?.();
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
        aria-expanded={isCollapsed ? undefined : open}
        disabled={props.navigationDisabled}
        title={label}
        onClick={() => toggleGroup(id, open, () => navigate(tab))}
      >
        <MobileIcon name={icon} size={20} color={itemColor(parent === tab)} />
        <span className="aw-nav-label">{label}</span>
        <span className="aw-nav-chev" aria-hidden="true">
          <MobileIcon name="chevron-right" size={14} color={parent === tab && isDark ? "#CBD5E1" : theme.textSecondary} />
        </span>
      </button>
      {open && !isCollapsed ? <div className="aw-nav-sub">{subs}</div> : null}
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
      case "createLead":
        return props.editingLead ? t.agent.leads.editLead : t.mobile.tabs.createLead;
      case "clients":
        return creatingTenant ? t.agent.tenants.create : t.mobile.drawerMenu.clients;
      default:
        return currentMenu ? menuLabel(currentMenu) : t.mobile.tabs[props.activeTab];
    }
  };
  const pageTitle =
    (settingsSection
      ? { profile: copy.settingsProfile, security: copy.settingsSecurity, display: copy.settingsDisplay, help: copy.settingsHelp }[settingsSection]
      : null) ||
    (customCurrent ? customCurrent.label : props.navSections ? t.mobile.tabs[props.activeTab] : agentTitle()) ||
    workspaceLabel;
  const switchRoles = ROLES.filter(
    (role) => !props.allowedRoles || props.allowedRoles.includes(role) || role === shellRole,
  );
  const create = props.onCreate
    ? (kind: Parameters<NonNullable<AgentWorkspaceProps["onCreate"]>>[0]) => {
        props.onCloseSettings?.();
        props.onCreate!(kind);
      }
    : undefined;
  const roleTile = roleTileColors(shellRole, isDark);
  // Initials avatar in the role colours (option ก, Mos 18 Nov 2026): ink and gold now mean admin only.
  const initialsStyle = { background: roleTile.bg, color: roleTile.fg };
  /** Breadcrumb middle item: the sidebar group or the parent page, when it is not the page itself. */
  const parentLabel =
    parent === "listingRoom"
      ? t.mobile.drawerMenu.listing
      : parent && parent !== props.activeTab
        ? (() => {
            const item = [...AGENT_WEB_PRIMARY, ...AGENT_WEB_MORE].find((entry) => entry.tab === parent);
            return item ? menuLabel(item) : null;
          })()
        : parent === "clients" && creatingTenant
          ? t.mobile.drawerMenu.clients
          : null;
  const crumbParent =
    !props.navSections && parent && parentLabel && parentLabel !== pageTitle ? { tab: parent, label: parentLabel } : null;
  const moreItem = (tab: string) => {
    const item = AGENT_WEB_MORE.find((entry) => entry.tab === tab);
    return item ? navItem(item) : null;
  };
  /** Coming-soon pages in one row (design จ2): contacts · services · team. */
  const laterLabels = [
    ...AGENT_WEB_MORE.filter((entry) => entry.tab === "contact" || entry.tab === "services").map(menuLabel),
    copy.team,
  ].join(" · ");

  const openDelete = () => {
    if (!props.onLoadAccountDeletion) return;
    setDeleteError(null);
    setDeleteBlocked(null);
    setDeleteOpen(true);
    void props.onLoadAccountDeletion().then((preview) => {
      setDeleteBlocked(preview.blocked ? preview.reasons : []);
      setDeleteScheduled(preview.scheduledFor);
      setDeleteNowAvailable(preview.deleteNowAvailable === true);
      setDeletePending(null);
    }).catch((cause: unknown) => {
      setDeleteError(cause instanceof Error && cause.message ? cause.message : t.common.errorGeneric);
    });
  };
  const app = t.mobile.appSettings;
  const account = t.mobile.account;
  const sectionLabel: Record<SettingsSection, string> = {
    profile: copy.settingsProfile,
    security: copy.settingsSecurity,
    display: copy.settingsDisplay,
    help: copy.settingsHelp,
  };
  const sectionHint: Record<SettingsSection, string> = {
    profile: copy.settingsProfileHint,
    security: copy.settingsSecurityHint,
    display: copy.settingsDisplayHint,
    help: copy.settingsHelpHint,
  };
  const openSection = (section: SettingsSection) => {
    accountRef.current?.removeAttribute("open");
    props.onOpenSettings?.(section);
  };
  const facts: { label: string; value: string }[] = [
    { label: account.fullName, value: props.userName },
    { label: account.email, value: props.userEmail || "-" },
    { label: account.phone, value: props.userPhone || "-" },
  ];

  const photoInput = (
    <input
      className="aw-photo-file"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      data-testid="settings.photo"
      onChange={(event) => {
        const file = event.target.files?.[0] ?? null;
        setProfilePhoto(file);
        setProfileRemove(false);
        setProfilePreview(file ? URL.createObjectURL(file) : null);
        // Review R10: clear the picker so the same file can be chosen again after Cancel.
        event.target.value = "";
      }}
    />
  );

  /** Settings header (canvas page "setting", T1): photo with the role ring, name, role chip, contact, then the tabs. */
  const settingsHeader = settingsSection ? (
    <section className="aw-settings-card aw-settings-hero" aria-label={copy.settings}>
      <div className="aw-settings-hero-body">
        <div className="aw-settings-avatar">
          <span className="aw-avatar-wrap" style={{ boxShadow: `0 0 0 3px var(--aw-surface), 0 0 0 5px ${roleTile.ring}` }}>
            {previewValue ? (
              <img className="aw-avatar aw-avatar-photo aw-avatar-xl" src={previewValue} alt="" />
            ) : (
              <span className="aw-avatar aw-avatar-xl" style={initialsStyle}>{props.initials}</span>
            )}
          </span>
          {canEditProfile && settingsSection === "profile" ? (
            <label className="aw-settings-camera" title={account.changePhoto}>
              <span className="aw-photo-sr">{account.changePhoto}</span>
              <MobileIcon name="camera" size={15} color="#211E1E" />
              {photoInput}
            </label>
          ) : null}
        </div>
        <div className="aw-settings-hero-text">
          <h2 className="aw-settings-name">{props.userName}</h2>
          <div className="aw-settings-meta">
            <span className="aw-settings-rolechip" style={{ background: roleTile.bg, color: roleTile.fg, boxShadow: `inset 0 0 0 1.5px ${roleTile.ring}` }}>
              <MobileIcon name={ROLE_ICON[shellRole] ?? "user"} size={15} color={roleTile.fg} />
              {t.roles[shellRole]}
            </span>
            {props.userEmail ? (
              <span className="aw-settings-metaitem">
                <MobileIcon name="envelope" size={16} color={theme.textSecondary} />
                {props.userEmail}
              </span>
            ) : null}
            {props.userPhone ? (
              <span className="aw-settings-metaitem">
                <MobileIcon name="phone" size={16} color={theme.textSecondary} />
                {props.userPhone}
              </span>
            ) : null}
          </div>
        </div>
        {canEditProfile && settingsSection !== "profile" ? (
          <button type="button" className="aw-button aw-button-secondary aw-settings-edit" data-testid="settings.editProfile" onClick={() => openSection("profile")}>
            <MobileIcon name="pencil" size={16} color={theme.screenTitle} />
            {account.editProfile}
          </button>
        ) : null}
      </div>
      <nav className="aw-settings-tabs" aria-label={copy.settings}>
        {SETTINGS_NAV.map((item) => {
          const current = item.key === settingsSection;
          return (
            <button
              key={item.key}
              type="button"
              className={`aw-settings-tab${current ? " is-current" : ""}`}
              aria-current={current ? "page" : undefined}
              data-testid={`settings.nav.${item.key}`}
              disabled={props.navigationDisabled}
              onClick={() => openSection(item.key)}
            >
              <MobileIcon name={item.icon} size={17} color={current ? (isDark ? "#F8B615" : "#795719") : theme.textSecondary} />
              <span>{sectionLabel[item.key]}</span>
            </button>
          );
        })}
      </nav>
    </section>
  ) : null;

  /** Profile tab (T1): the agent edits inline, save bar bottom left; other roles read it here and edit in the app. */
  const profileSection = (
    <>
      <section className="aw-settings-card" aria-labelledby="aw-settings-profile-title">
        <h3 id="aw-settings-profile-title" className="aw-settings-title">{account.personalInfo}</h3>
        <p className="aw-settings-desc">{sectionHint.profile}</p>
        {canEditProfile ? (
          <form
            className="aw-profile-form aw-settings-form"
            data-testid="settings.profile.form"
            onSubmit={(event) => {
              event.preventDefault();
              return saveProfile();
            }}
          >
            <div className="aw-settings-fields">
              <label>
                {account.firstName}
                <input value={firstValue} onChange={(event) => setProfileFirst(event.target.value)} autoComplete="given-name" />
              </label>
              <label>
                {account.lastName}
                <input value={lastValue} onChange={(event) => setProfileLast(event.target.value)} autoComplete="family-name" />
              </label>
              <label>
                {account.phone}
                <input value={phoneValue} onChange={(event) => setProfilePhone(event.target.value)} autoComplete="tel" inputMode="tel" />
              </label>
              <label>
                {account.email}
                <input value={props.userEmail} readOnly aria-readonly="true" className="is-readonly" />
              </label>
            </div>
            {previewValue ? (
              <div className="aw-settings-photo-row">
                <span className="aw-photo-hint">{account.changePhoto}: JPG, PNG, WEBP</span>
                <button
                  type="button"
                  className="aw-photo-remove"
                  onClick={() => {
                    setProfilePhoto(null);
                    setProfileRemove(true);
                    setProfilePreview(null);
                  }}
                >
                  {account.removePhoto}
                </button>
              </div>
            ) : null}
            {profileError ? <p className="aw-profile-error" role="alert">{profileError}</p> : null}
            <div className="aw-settings-savebar">
              <button type="submit" className="aw-button aw-button-primary" disabled={profileSaving || !profileDirty}>
                {profileSaving ? t.common.loading : t.common.save}
              </button>
              <button type="button" className="aw-button aw-button-secondary" disabled={profileSaving || !profileDirty} onClick={resetProfile}>
                {t.common.cancel}
              </button>
            </div>
            {shellRole === "admin" ? (
              <p className="aw-settings-note" data-testid="settings.admin.note">
                <MobileIcon name="info" size={16} color={theme.textSecondary} />
                <span>{copy.adminSettingsNote}</span>
              </p>
            ) : null}
          </form>
        ) : (
          <>
            <dl className="aw-settings-facts">
              {facts.map((fact) => (
                <div key={fact.label} className="aw-settings-fact">
                  <dt>{fact.label}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
            </dl>
            <p className="aw-settings-note" data-testid="settings.profile.readOnly">
              <MobileIcon name="info" size={16} color={theme.textSecondary} />
              <span>{copy.profileReadOnly}</span>
            </p>
          </>
        )}
      </section>
      <section className="aw-settings-card" aria-labelledby="aw-settings-roles-title">
        <h3 id="aw-settings-roles-title" className="aw-settings-title">{copy.accountRoles}</h3>
        <div className="aw-settings-rows">
          {switchRoles.map((role) => {
            const tile = roleTileColors(role, isDark);
            const current = role === shellRole;
            return (
              <button
                key={role}
                type="button"
                className={`aw-settings-row aw-settings-role-row${current ? " is-current" : ""}`}
                aria-current={current ? "true" : undefined}
                disabled={!!props.navigationDisabled}
                data-testid={`settings.role.${role}`}
                onClick={() => {
                  if (!current) props.onRoleChange(role);
                }}
              >
                <span className="aw-role-tile" aria-hidden="true" style={{ background: tile.bg, boxShadow: `0 0 0 1.5px ${tile.ring}` }}>
                  <MobileIcon name={ROLE_ICON[role] ?? "user"} size={15} color={tile.fg} />
                </span>
                <span className="aw-role-text">
                  <strong>{t.roles[role]}</strong>
                  <small>{t.mobile.profile.roleDescriptions[role as keyof typeof t.mobile.profile.roleDescriptions] ?? ""}</small>
                </span>
                {current ? (
                  <MobileIcon name="check" size={16} color={isDark ? "#F8B615" : "#795719"} />
                ) : props.otherSiteRoles?.includes(role) ? (
                  <span className="aw-role-badge">{t.webSession.otherSite}</span>
                ) : (
                  <MobileIcon name="chevron-right" size={14} color={theme.textSecondary} />
                )}
              </button>
            );
          })}
        </div>
        {props.otherSiteRoles?.length ? <p className="aw-settings-note">{copy.roleHint}</p> : null}
      </section>
    </>
  );

  /** Security tab (T2): password, linked accounts, devices, then the danger zone. */
  const securitySection = (
    <>
      {props.onChangePassword ? (
        <section className="aw-settings-card" aria-labelledby="aw-settings-password-title">
          <h3 id="aw-settings-password-title" className="aw-settings-title">{account.changePassword}</h3>
          <p className="aw-settings-desc">{t.mobile.auth.passwordRules}</p>
          <form
            className="aw-profile-form aw-settings-form"
            data-testid="settings.password.form"
            onSubmit={(event) => {
              event.preventDefault();
              return savePassword();
            }}
          >
            <div className="aw-settings-fields">
              <label>
                {account.password.current}
                <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" />
              </label>
              <span aria-hidden="true" />
              <label>
                {account.password.new}
                <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" />
              </label>
              <label>
                {account.password.confirm}
                <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" />
              </label>
            </div>
            {/* Review R2: the box is always shown here (no wait-for-token step like sign-in), and it is not drawn while
                the delete dialog asks for the password, so the two forms never share one Turnstile token. */}
            {captchaRequired && !deletePending ? <CaptchaField resetKey={captchaKey} onToken={setCaptchaToken} /> : null}
            {passwordError ? <p className="aw-profile-error" role="alert">{passwordError}</p> : null}
            <div className="aw-settings-savebar">
              <button type="submit" className="aw-button aw-button-primary" disabled={passwordSaving}>
                {passwordSaving ? t.common.loading : account.password.submit}
              </button>
            </div>
          </form>
        </section>
      ) : null}
      {shellRole === "admin" ? (
        <section className="aw-settings-card" aria-labelledby="aw-settings-2fa-title" data-testid="settings.twoFactor">
          <h3 id="aw-settings-2fa-title" className="aw-settings-title">{copy.twoFactor}</h3>
          <p className="aw-settings-desc">{copy.twoFactorBody}</p>
          <div className="aw-settings-row is-soon" aria-disabled="true">
            <span className="aw-settings-ico"><MobileIcon name="shield" size={18} color={theme.textSecondary} /></span>
            <span>{copy.twoFactor}</span>
            <span className="aw-soon">{t.agent.dashboard.comingSoon}</span>
          </div>
        </section>
      ) : null}
      <section className="aw-settings-card" aria-labelledby="aw-settings-linked-title">
        <h3 id="aw-settings-linked-title" className="aw-settings-title">{account.linkedAccounts.title}</h3>
        <div className="aw-settings-tiles">
          <div className="aw-settings-row is-static">
            <span className="aw-settings-ico"><MobileIcon name="envelope" size={18} color={theme.screenTitle} /></span>
            <span className="aw-role-text">
              <strong>{copy.emailPassword}</strong>
              <small>{props.userEmail}</small>
            </span>
            <span className="aw-settings-ok">{account.linkedAccounts.connected}</span>
          </div>
          {(["google", "facebook", "apple"] as const).map((provider) => (
            <div key={provider} className="aw-settings-row is-soon" aria-disabled="true">
              <span className="aw-settings-ico"><MobileIcon name={provider} size={18} color={theme.textSecondary} /></span>
              <span>{account.linkedAccounts.providers[provider]}</span>
              <span className="aw-soon">{t.agent.dashboard.comingSoon}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="aw-settings-card" aria-labelledby="aw-settings-devices-title">
        <h3 id="aw-settings-devices-title" className="aw-settings-title">{copy.devices}</h3>
        <p className="aw-settings-desc">{copy.devicesBody}</p>
        <div className="aw-settings-actions">
          <button type="button" className="aw-signout" disabled={props.navigationDisabled} onClick={props.onSignOut}>
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
        </div>
      </section>
      {canDeleteAccount ? (
        <section className="aw-settings-card aw-settings-danger" aria-labelledby="aw-settings-danger-title" data-testid="settings.danger">
          <h3 id="aw-settings-danger-title" className="aw-settings-title">{copy.dangerZone}</h3>
          {deleteOpen ? (
            <div className="aw-profile-form">
              <p className="aw-photo-hint">{account.deleteAccountBody}</p>
              {deleteBlocked && deleteBlocked.length > 0 ? (
                <>
                  <p className="aw-profile-error">{account.deleteAccountBlocked}</p>
                  {deleteBlocked.map((reason) => (
                    <p key={reason} className="aw-profile-error">{account.deleteAccountReasons[reason as 'open_contract' | 'open_agent_contract' | 'unpaid_bill' | 'bill_awaiting_review' | 'unrefunded_deposit']}</p>
                  ))}
                </>
              ) : null}
              {deleteScheduled ? <p className="aw-photo-hint">{account.deleteAccountScheduled.replace("{date}", new Date(deleteScheduled).toLocaleDateString(dateLocale(locale), { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Bangkok" }))}</p> : null}
              {deleteError ? <p className="aw-profile-error" role="alert">{deleteError}</p> : null}
              <div className="aw-settings-actions">
                {!deleteBlocked?.length && !deleteScheduled ? (
                  <>
                    {deleteNowAvailable ? <button type="button" className="aw-button aw-button-danger" disabled={deleteBusy || deleteBlocked === null} onClick={() => setDeletePending('now')}>{account.deleteAccountNow}</button> : null}
                    <button type="button" className="aw-button aw-button-secondary" disabled={deleteBusy || deleteBlocked === null} onClick={() => setDeletePending('later')}>{account.deleteAccountLater}</button>
                  </>
                ) : null}
                {deleteScheduled && props.onCancelAccountDeletion ? (
                  <button type="button" className="aw-button aw-button-secondary" disabled={deleteBusy} onClick={() => {
                    setDeleteError(null);
                    setDeletePasswordStep(false);
                    setDeletePending("cancel");
                  }}>{account.deleteAccountCancel}</button>
                ) : null}
                <button type="button" className="aw-button aw-button-secondary" disabled={deleteBusy} onClick={() => { setDeleteOpen(false); setDeletePending(null); }}>
                  {t.common.cancel}
                </button>
              </div>
            </div>
          ) : (
            <div className="aw-settings-danger-row">
              <span className="aw-role-text">
                <strong>{account.deleteAccount}</strong>
                <small>{account.deleteAccountBody}</small>
              </span>
              <button type="button" className="aw-button aw-settings-danger-button" onClick={openDelete}>
                <MobileIcon name="trash" size={16} color={isDark ? "#FCA5A5" : "#B42318"} />
                {account.deleteAccount}
              </button>
            </div>
          )}
        </section>
      ) : shellRole === "admin" || props.adminAccount ? (
        <p className="aw-settings-note" data-testid="settings.admin.deleteNote">
          <MobileIcon name="info" size={16} color={theme.textSecondary} />
          <span>{copy.adminDeleteNote}</span>
        </p>
      ) : null}
    </>
  );

  /** Display tab (T3): the same language and theme choices as the header pill bar, as cards. */
  const displaySection = (
    <section className="aw-settings-card">
      <h3 id="aw-settings-language-title" className="aw-settings-title">{t.mobile.settings.language}</h3>
      <p className="aw-settings-desc">{sectionHint.display}</p>
      <div className="aw-settings-choices" role="radiogroup" aria-labelledby="aw-settings-language-title">
        {Object.entries(t.mobile.settings.languageNames).map(([key, label]) => {
          const current = key === locale;
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={current}
              className={`aw-settings-choice${current ? " is-current" : ""}`}
              data-testid={`settings.language.${key}`}
              onClick={() => setLocale(key as SupportedLocale)}
            >
              <MobileIcon name="globe" size={18} color={theme.textSecondary} />
              <span>{label}</span>
              <span className="aw-settings-radio" aria-hidden="true">
                {current ? <MobileIcon name="check" size={12} color="#211E1E" weight="bold" /> : null}
              </span>
            </button>
          );
        })}
      </div>
      <h3 id="aw-settings-theme-title" className="aw-settings-title aw-settings-subtitle">{copy.theme}</h3>
      <div className="aw-settings-choices aw-settings-themes" role="radiogroup" aria-labelledby="aw-settings-theme-title">
        {themeOptions.map((option) => {
          const current = option.key === themePref;
          return (
            <button
              key={option.key}
              type="button"
              role="radio"
              aria-checked={current}
              className={`aw-settings-choice${current ? " is-current" : ""}`}
              data-testid={`settings.theme.${option.key}`}
              onClick={() => chooseTheme(option.key)}
            >
              <span className={`aw-theme-preview is-${option.key}`} aria-hidden="true" />
              <span className="aw-settings-choice-line">
                {option.key === "system" ? <MonitorIcon /> : option.key === "dark" ? <MoonIcon /> : <SunIcon />}
                <span>{option.label}</span>
                <span className="aw-settings-radio" aria-hidden="true">
                  {current ? <MobileIcon name="check" size={12} color="#211E1E" weight="bold" /> : null}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );

  /** Help and about tab (T4): two columns. Terms and privacy open in a new tab like the footer (review R9). */
  const helpSection = (
    <div className="aw-settings-columns">
      <section className="aw-settings-card" aria-labelledby="aw-settings-help-title">
        <h3 id="aw-settings-help-title" className="aw-settings-title">{app.helpSection}</h3>
        <details className="aw-settings-info">
          <summary>{app.faq}</summary>
          <p>{app.faqBody}</p>
        </details>
        <details className="aw-settings-info">
          <summary>{app.contactSupport}</summary>
          <p>{app.supportBody}</p>
        </details>
      </section>
      <section className="aw-settings-card" aria-labelledby="aw-settings-about-title">
        <h3 id="aw-settings-about-title" className="aw-settings-title">{app.aboutSection}</h3>
        <details className="aw-settings-info">
          <summary>{app.aboutNestyk}</summary>
          <p>{app.aboutBody}</p>
        </details>
        <a className="aw-settings-row" href={legalHref("terms")} target="_blank" rel="noopener">
          <MobileIcon name="file-text" size={18} color={theme.textSecondary} />
          <span>{app.terms}</span>
          <MobileIcon name="chevron-right" size={14} color={theme.textSecondary} />
        </a>
        <a className="aw-settings-row" href={legalHref("privacy")} target="_blank" rel="noopener">
          <MobileIcon name="shield" size={18} color={theme.textSecondary} />
          <span>{app.privacy}</span>
          <MobileIcon name="chevron-right" size={14} color={theme.textSecondary} />
        </a>
        <a className="aw-settings-row" href={COOKIE_SETTINGS_HREF} data-testid="settings.cookies">
          <MobileIcon name="sliders" size={18} color={theme.textSecondary} />
          <span>{t.legal.footer.cookies}</span>
          <MobileIcon name="chevron-right" size={14} color={theme.textSecondary} />
        </a>
        <div className="aw-settings-row is-static">
          <MobileIcon name="info" size={18} color={theme.textSecondary} />
          <span>{app.version}</span>
          <span className="aw-settings-value">{APP_VERSION}</span>
        </div>
      </section>
    </div>
  );

  /** Settings page "/<role>/settings[/section]" (Mos 18 Nov 2026, canvas page "setting"): header card + 4 tabs. */
  const settingsPage = settingsSection ? (
    <WebContentContainer>
      <div className="aw-settings" data-testid="settings.page">
        {settingsHeader}
        <div className="aw-settings-body" data-testid={`settings.section.${settingsSection}`}>
          {settingsSection === "profile"
            ? profileSection
            : settingsSection === "security"
              ? securitySection
              : settingsSection === "display"
                ? displaySection
                : helpSection}
        </div>
      </div>
    </WebContentContainer>
  ) : null;

  return (
      <div
        className={`aw-shell${isCollapsed ? " aw-collapsed" : ""}`}
        data-theme={theme.mode}
        lang={locale}
        style={
          {
            "--aw-bg": isDark ? theme.background : "#F1F5F9",
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
          <div className="aw-topbar-main">
            <nav className="aw-crumbs" aria-label={copy.breadcrumb}>
              {!settingsOpen && (props.navSections || props.activeTab === "dashboard") ? null : (
                <>
                  <button
                    type="button"
                    className="aw-crumb-link"
                    onClick={() => navigate("dashboard")}
                    disabled={props.navigationDisabled}
                    aria-label={copy.home}
                    title={copy.home}
                  >
                    <MobileIcon name="home" size={17} color={theme.textSecondary} />
                  </button>
                  <span className="aw-crumb-sep" aria-hidden="true">/</span>
                </>
              )}
              {settingsOpen ? (
                <>
                  <button
                    type="button"
                    className="aw-crumb-link"
                    data-testid="settings.crumb"
                    onClick={() => openSection("profile")}
                    disabled={props.navigationDisabled}
                  >
                    {copy.settings}
                  </button>
                  <span className="aw-crumb-sep" aria-hidden="true">/</span>
                </>
              ) : null}
              {crumbParent ? (
                <>
                  <button
                    type="button"
                    className="aw-crumb-link"
                    onClick={() => navigate(crumbParent.tab)}
                    disabled={props.navigationDisabled}
                  >
                    {crumbParent.label}
                  </button>
                  <span className="aw-crumb-sep" aria-hidden="true">/</span>
                </>
              ) : null}
              <h1 className="aw-title">{pageTitle}</h1>
            </nav>
            <div className="aw-topbar-actions aw-pillbar">
              {create ? (
                <WebMenu
                  label={copy.create}
                  testID="shell.create"
                  triggerClassName="aw-create"
                  trigger={
                    <>
                      <MobileIcon name="plus" size={17} color={isDark ? "#FFFFFF" : "#211E1E"} />
                      <span className="aw-create-label">{copy.create}</span>
                      <MobileIcon name="chevron-down" size={13} color={isDark ? "#CBD5E1" : "#475569"} />
                    </>
                  }
                  items={[
                    { key: "room", icon: "buildings", label: t.agent.dashboard.addListing, disabled: props.navigationDisabled, onSelect: () => create("room") },
                    { key: "lead", icon: "clipboard", label: t.agent.dashboard.newLead, disabled: props.navigationDisabled, onSelect: () => create("lead") },
                    { key: "tenant", icon: "user-plus", label: t.agent.tenants.create, disabled: props.navigationDisabled, onSelect: () => create("tenant") },
                  ]}
                />
              ) : null}
              {create ? <span className="aw-pill-sep" aria-hidden="true" /> : null}
              <WebMenu
                label={`${t.mobile.settings.language}: ${t.mobile.settings.languageNames[locale]}`}
                testID="shell.language"
                triggerClassName="aw-icon-button aw-lang"
                trigger={<MobileIcon name="globe" size={19} color={theme.screenTitle} />}
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
              <details className="aw-account aw-account-top" ref={accountRef}>
                  <summary aria-label={`${copy.account}: ${props.userName}`}>
                    <span
                      className="aw-avatar-wrap"
                      style={{ boxShadow: `0 0 0 2px var(--aw-surface), 0 0 0 3.5px ${roleTile.ring}` }}
                    >
                      {props.avatarUrl ? (
                        <img className="aw-avatar aw-avatar-photo" src={props.avatarUrl} alt="" />
                      ) : (
                        <span className="aw-avatar" style={initialsStyle}>{props.initials}</span>
                      )}
                      <span
                        className="aw-avatar-role"
                        aria-hidden="true"
                        style={{ background: roleTile.bg, borderColor: roleTile.ring }}
                      >
                        <MobileIcon name={ROLE_ICON[shellRole] ?? "user"} size={9} color={roleTile.fg} />
                      </span>
                    </span>
                  </summary>
                  <div className="aw-account-popover">
                    <div className="aw-account-info">
                      <strong>{props.userName}</strong>
                      <span>{props.userEmail}</span>
                    </div>
                    {rolePickerOpen ? (
                      <div className="aw-role-picker">
                        <button type="button" className="aw-role-back" onClick={() => setRolePickerOpen(false)}>
                          <MobileIcon name="chevron-left" size={16} color={theme.screenTitle} />
                          {copy.chooseRole}
                        </button>
                        <p className="aw-role-hint">{copy.roleHint}</p>
                        {switchRoles.map((role) => {
                          const tile = roleTileColors(role, isDark);
                          const current = role === shellRole;
                          return (
                            <button
                              key={role}
                              type="button"
                              className={`aw-role-option${current ? " is-current" : ""}`}
                              aria-current={current ? "true" : undefined}
                              disabled={props.navigationDisabled}
                              data-testid={`account.role.${role}`}
                              onClick={() => {
                                accountRef.current?.removeAttribute("open");
                                if (!current) props.onRoleChange(role);
                              }}
                            >
                              <span className="aw-role-tile" aria-hidden="true" style={{ background: tile.bg, boxShadow: `0 0 0 1.5px ${tile.ring}` }}>
                                <MobileIcon name={ROLE_ICON[role] ?? "user"} size={15} color={tile.fg} />
                              </span>
                              <span className="aw-role-text">
                                <strong>{t.roles[role]}</strong>
                                <small>{t.mobile.profile.roleDescriptions[role as keyof typeof t.mobile.profile.roleDescriptions] ?? ""}</small>
                              </span>
                              {current ? (
                                <MobileIcon name="check" size={16} color={isDark ? "#F8B615" : "#795719"} />
                              ) : props.otherSiteRoles?.includes(role) ? (
                                <span className="aw-role-badge">{t.webSession.otherSite}</span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="aw-role-row"
                        data-testid="account.role"
                        disabled={switchRoles.length < 2 || !!props.navigationDisabled}
                        onClick={() => setRolePickerOpen(true)}
                      >
                        <span className="aw-role-tile" aria-hidden="true" style={{ background: roleTile.bg, boxShadow: `0 0 0 1.5px ${roleTile.ring}` }}>
                          <MobileIcon name={ROLE_ICON[shellRole] ?? "user"} size={15} color={roleTile.fg} />
                        </span>
                        <span className="aw-role-text">
                          <small>{t.mobile.profile.role}</small>
                          <strong>{t.roles[shellRole]}</strong>
                        </span>
                        {switchRoles.length > 1 ? (
                          <>
                            <span className="aw-role-change">{copy.changeRole}</span>
                            <MobileIcon name="chevron-right" size={14} color={theme.textSecondary} />
                          </>
                        ) : null}
                      </button>
                    )}
                    {rolePickerOpen ? null : <>
                    {props.onOpenSettings ? (
                      <>
                        <div className="aw-menu-sep" aria-hidden="true" />
                        <button
                          type="button"
                          className="aw-menu-row"
                          data-testid="account.settings"
                          onClick={() => openSection("profile")}
                        >
                          <MobileIcon name="gear" size={18} color={theme.textSecondary} />
                          <span>{copy.settings}</span>
                          <MobileIcon name="chevron-right" size={14} color={theme.textSecondary} />
                        </button>
                        <button
                          type="button"
                          className="aw-menu-row"
                          data-testid="account.help"
                          onClick={() => openSection("help")}
                        >
                          <MobileIcon name="info" size={18} color={theme.textSecondary} />
                          <span>{t.mobile.appSettings.helpSection}</span>
                          <MobileIcon name="chevron-right" size={14} color={theme.textSecondary} />
                        </button>
                      </>
                    ) : null}
                    <button
                      type="button"
                      className="aw-signout"
                      disabled={props.navigationDisabled}
                      onClick={props.onSignOut}
                    >
                      {t.common.signOut}
                    </button>
                    </>}
                  </div>
                </details>
            </div>
          </div>
        </header>
        <aside className="aw-sidebar" aria-label={t.mobile.profile.navigation}>
          <div className="aw-logo-cell aw-side-brand">
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
            <button
              type="button"
              className="aw-collapse"
              data-testid="shell.sidebarToggle"
              onClick={() => (formCompact ? setFormMenuOpen(!formMenuOpen) : setCollapsed(!collapsed))}
              aria-label={isCollapsed ? copy.expand : copy.collapse}
              aria-expanded={!isCollapsed}
              title={isCollapsed ? copy.expand : copy.collapse}
            >
              <PanelIcon collapsed={isCollapsed} />
            </button>
          </div>
          <div className="aw-switch">
            {/* Mos 18 Nov 2026: the role box only shows the current role; switching is in the account menu. */}
            <div className="aw-switcher aw-switcher-static" data-testid="shell.workspace">
              <span
                className="aw-switch-tile"
                aria-hidden="true"
                style={{ background: roleTile.bg, boxShadow: `0 0 0 1.5px ${roleTile.ring}` }}
              >
                <MobileIcon name={ROLE_ICON[shellRole] ?? "user"} size={18} color={roleTile.fg} />
              </span>
              <span className="aw-switch-copy">
                <strong>{t.roles[shellRole]}</strong>
                <small>{workspaceLabel}</small>
              </span>
            </div>
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
                  {moreItem("calendar")}
                </nav>
                <div className="aw-nav-divider" />
                <p className="aw-nav-caption">{copy.docsFinance}</p>
                <nav className="aw-nav" aria-label={copy.docsFinance}>
                  {moreItem("contracts")}
                  {soonItem("commission", "wallet", t.mobile.drawerMenu.commission)}
                </nav>
                <div className="aw-nav-divider" />
                <p className="aw-nav-caption">{t.agent.dashboard.comingSoon}</p>
                {soonItem("later", "dots-vertical", laterLabels)}
              </>
            )}
          </div>
        </aside>

          <main
            id="agent-web-main"
            className="aw-main"
            data-page-width={settingsOpen ? "wide" : agentWebPageWidth(props.activeTab, props.creating)}
            tabIndex={-1}
          >
            {settingsPage ?? props.children}
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
                // Settings page (18 Nov 2026): the user stays on the section they saved from.
                setComplete(null);
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
              {deletePasswordStep && captchaRequired ? <CaptchaField resetKey={captchaKey} onToken={setCaptchaToken} /> : null}
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
