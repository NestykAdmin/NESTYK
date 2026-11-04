import React, { useEffect, useRef } from "react";
import { useLocale, type SupportedLocale } from "@nestyk/i18n";
import {
  MobileIcon,
  MobileNestykLogo,
  useMobileTheme,
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
import { AgentSelect } from "./AgentSelect";
import { passwordIsStrong } from "../../lib/auth/password-rules";
import { hcaptchaSiteKey } from "../../lib/auth/hcaptcha-site-key";
import { HcaptchaField } from "../../components/HcaptchaField";

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

  if (!props.enabled)
    return <>{props.children}</>;

  const navigate = (tab: Parameters<AgentWorkspaceProps["onNavigate"]>[0]) => {
    accountRef.current?.removeAttribute("open");
    props.onNavigate(tab);
  };
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
                  {props.avatarUrl ? (
                    <img className="aw-avatar aw-avatar-photo" src={props.avatarUrl} alt="" />
                  ) : (
                    <span className="aw-avatar">{props.initials}</span>
                  )}
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
                  {accountMenuOpen || deleteOpen ? null : <>
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
                      {ROLES.filter((role) => !props.allowedRoles || props.allowedRoles.includes(role) || role === shellRole).map((role) => (
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
                  </>}
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
                  </>}
                </div>
              </details>
            </div>
          </header>
          <main id="agent-web-main" className="aw-main" tabIndex={-1}>
            {props.children}
          </main>
        </div>
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
