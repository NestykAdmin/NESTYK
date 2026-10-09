import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Switch,
  useWindowDimensions,
  BackHandler,
} from 'react-native';
import { MobileButton } from '../components/MobileButton';
import { MobileNestykLogo } from '../components/MobileNestykLogo';
import { MobileProfileAvatar } from '../components/MobileProfileAvatar';
import { MobileProfileEditBody } from '../components/MobileProfileEditBody';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocale } from '@nestyk/i18n';
import { UserRole } from '@nestyk/types';
import { MobileIcon } from '../icons/MobileIcon';
import { SelectionCheck } from '../components/SelectionCheck';
import { AppIconName } from '../icons/types';
import { tokens } from '../theme/tokens';
import { getCardElevation } from '../theme/elevation';
import { useMobileTheme } from '../theme/ThemeContext';
import { MobileBottomSheet } from '../components/MobileBottomSheet';
import { MobileLanguagePickerBody } from '../components/MobileLanguagePickerBody';
import { MobileAccountSettingsBody, MobileAccountSettingsBodyHandle } from './MobileAccountSettingsBody';
import {
  DrawerMenuAction,
  DrawerMenuItem,
  getDrawerMenuForRole,
} from '../config/mobileDrawerMenuMatrix';

type DrawerSubView = 'language' | 'account' | 'roleMenu' | 'profile';

const PANEL_MARGIN = 12;
const PANEL_RADIUS = 28;

export interface MobileProfileDrawerProps {
  visible: boolean;
  onClose: () => void;
  userName: string;
  userEmail: string;
  userPhone?: string;
  initials: string;
  activeRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  onSignOut?: () => void;
  signOutLabel?: string;
  onMenuAction?: (action: DrawerMenuAction) => void;
  /** When false, Edit Profile / App Settings that need an account redirect via onRequireAuth. */
  isAuthenticated?: boolean;
  onRequireAuth?: () => void;
  /** Roles available to this account. Pass authenticated permissions in production. */
  allowedRoles?: UserRole[];
}

const ROLE_OPTIONS: { key: UserRole; icon: AppIconName }[] = [
  { key: 'guest', icon: 'search' },
  { key: 'tenant', icon: 'home' },
  { key: 'owner', icon: 'key' },
  { key: 'agent', icon: 'handshake' },
  { key: 'admin', icon: 'shield' },
];

const DEFAULT_ALLOWED_ROLES: UserRole[] = ['guest', 'tenant', 'owner', 'agent', 'admin'];

const BRAND_YELLOW = tokens.colors.brand[500];

function hexToRgba(hex: string, alpha: number): string {
  const raw = hex.replace('#', '');
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/** Soft role-colored chip background — same hue, opacity tuned per mode. */
function roleIconTint(role: UserRole, dark: boolean): string {
  const hue = tokens.colors.roles[role] || BRAND_YELLOW;
  return hexToRgba(hue, dark ? 0.2 : 0.12);
}

/** Brand yellow soft fill for selected rows. */
function brandSoftFill(dark: boolean): string {
  return hexToRgba(BRAND_YELLOW, dark ? 0.16 : 0.14);
}

function nativeElevation(level: 1 | 2 | 3) {
  const { boxShadow: _webOnly, ...rest } = getCardElevation(level);
  return rest;
}

export const MobileProfileDrawer: React.FC<MobileProfileDrawerProps> = ({
  visible,
  onClose,
  userName,
  userEmail,
  userPhone,
  initials,
  activeRole,
  onRoleChange,
  onSignOut,
  signOutLabel,
  onMenuAction,
  isAuthenticated = true,
  onRequireAuth,
  allowedRoles = DEFAULT_ALLOWED_ROLES,
}) => {
  const { t, locale } = useLocale();
  const { theme, themeMode, setThemeMode, isDark } = useMobileTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const panelWidth = Math.max(windowWidth - PANEL_MARGIN * 2, 0);
  const slideDistance = panelWidth + PANEL_MARGIN;

  const roleColor = tokens.colors.roles[activeRole] || tokens.colors.brand[500];
  const mutedIcon = theme.textSecondary;
  const brandSoft = brandSoftFill(isDark);
  const decorOpacity = isDark ? 0.2 : 0.35;
  const decorRingColor = BRAND_YELLOW;
  const [mounted, setMounted] = useState(false);
  const [rolePickerOpen, setRolePickerOpen] = useState(false);
  const [settingsView, setSettingsView] = useState<'main' | DrawerSubView>('main');
  const [accountNestedTitle, setAccountNestedTitle] = useState<string | null>(null);
  const [submenuParent, setSubmenuParent] = useState<DrawerMenuItem | null>(null);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const accountRef = useRef<MobileAccountSettingsBodyHandle>(null);
  const translateX = useSharedValue(-slideDistance);
  const overlayOpacity = useSharedValue(0);
  const contentSlideX = useSharedValue(0);
  const contentWidth = panelWidth - 28;

  const drawerSections = getDrawerMenuForRole(activeRole);
  const visibleRoleOptions = ROLE_OPTIONS.filter(
    (role) => allowedRoles.includes(role.key) || role.key === activeRole,
  );
  const isGuestHeader = activeRole === 'guest';
  const headerBtnBg = isGuestHeader ? 'rgba(33,30,30,0.08)' : 'rgba(255,255,255,0.92)';

  const openSubView = (view: DrawerSubView) => {
    if ((view === 'profile' || view === 'account') && !isAuthenticated) {
      onRequireAuth?.();
      return;
    }
    setSettingsView(view);
    contentSlideX.value = withTiming(-contentWidth, { duration: 220 });
  };

  const closeSubView = () => {
    contentSlideX.value = withTiming(0, { duration: 200 }, (finished) => {
      if (finished) {
        runOnJS(setSettingsView)('main');
        runOnJS(setSubmenuParent)(null);
      }
    });
    setAccountNestedTitle(null);
  };

  const handleAccountNestedChange = (active: boolean, title?: string) => {
    setAccountNestedTitle(active ? title ?? null : null);
  };

  const handleSubBack = () => {
    if (settingsView === 'account' && accountRef.current?.handleBack()) {
      return;
    }
    closeSubView();
  };

  const handleSignOut = () => {
    onSignOut?.();
    onClose();
  };

  const dispatchMenuAction = (action?: DrawerMenuAction) => {
    if (!action) return;
    onMenuAction?.(action);
    onClose();
  };

  const handleMenuItemPress = (item: DrawerMenuItem) => {
    if (item.children && item.children.length > 0) {
      const presentation = item.presentation ?? 'expand';
      if (presentation === 'expand') {
        setExpandedIds((prev) => ({ ...prev, [item.id]: !prev[item.id] }));
        return;
      }
      setSubmenuParent(item);
      openSubView('roleMenu');
      return;
    }
    dispatchMenuAction(item.action);
  };

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateX.value = withTiming(0, { duration: 250 });
      overlayOpacity.value = withTiming(1, { duration: 200 });
    } else if (mounted) {
      translateX.value = withTiming(-slideDistance, { duration: 200 }, (finished) => {
        if (finished) runOnJS(setMounted)(false);
      });
      overlayOpacity.value = withTiming(0, { duration: 150 });
    }
  }, [visible, mounted, slideDistance, translateX, overlayOpacity]);

  useEffect(() => {
    if (!visible) {
      setRolePickerOpen(false);
      setSettingsView('main');
      setAccountNestedTitle(null);
      setSubmenuParent(null);
      setExpandedIds({});
      contentSlideX.value = 0;
    }
  }, [visible, contentSlideX]);

  useEffect(() => {
    if (!isAuthenticated) {
      setRolePickerOpen(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    setExpandedIds({});
    setSubmenuParent(null);
    if (settingsView === 'roleMenu') {
      setSettingsView('main');
      contentSlideX.value = 0;
    }
  }, [activeRole]);

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (rolePickerOpen) {
        setRolePickerOpen(false);
        return true;
      }
      if (settingsView !== 'main') {
        handleSubBack();
        return true;
      }
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose, settingsView, rolePickerOpen]);

  const panGesture = Gesture.Pan()
    .enabled(!rolePickerOpen)
    .activeOffsetX([-18, 18])
    .failOffsetY([-16, 16])
    .onUpdate((event) => {
      'worklet';
      const next = Math.min(0, Math.max(-slideDistance, event.translationX));
      translateX.value = next;
      overlayOpacity.value = 1 + next / slideDistance;
    })
    .onEnd((event) => {
      'worklet';
      const shouldClose =
        translateX.value < -slideDistance * 0.32 || event.velocityX < -700;
      if (shouldClose) {
        runOnJS(onClose)();
      } else {
        translateX.value = withTiming(0, { duration: 200 });
        overlayOpacity.value = withTiming(1, { duration: 150 });
      }
    });

  const drawerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const contentSlideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: contentSlideX.value }],
  }));

  const subViewTitle =
    settingsView === 'profile'
      ? t.mobile.account.editProfile
      : settingsView === 'language'
      ? t.mobile.settings.language
      : settingsView === 'roleMenu' && submenuParent
        ? t.mobile.drawerMenu[submenuParent.labelKey]
        : settingsView === 'account'
          ? accountNestedTitle ?? t.mobile.appSettings.title
          : t.mobile.appSettings.title;

  const currentLanguageLabel = t.mobile.settings.languageNames[locale];

  const renderMenuRow = (item: DrawerMenuItem, opts?: { nested?: boolean; isLast?: boolean }) => {
    const hasChildren = Boolean(item.children?.length);
    const isExpanded = Boolean(expandedIds[item.id]);
    const isLeaf = !hasChildren && Boolean(item.action);

    return (
      <View key={item.id}>
        <TouchableOpacity
          style={[
            styles.settingRow,
            opts?.nested && styles.menuNestedRow,
            !opts?.isLast && !isExpanded && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
          ]}
          onPress={() => handleMenuItemPress(item)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t.mobile.drawerMenu[item.labelKey]}
        >
          <MobileIcon
            name={item.icon}
            size={opts?.nested ? 18 : 20}
            color={opts?.nested ? theme.textSecondary : roleColor}
          />
          <Text style={[styles.navLabel, { color: theme.textHeading }]}>
            {t.mobile.drawerMenu[item.labelKey]}
          </Text>
          {hasChildren ? (
            <MobileIcon
              name={isExpanded ? 'chevron-down' : 'chevron-right'}
              size={18}
              color={mutedIcon}
            />
          ) : isLeaf ? (
            <MobileIcon name="chevron-right" size={18} color={mutedIcon} />
          ) : null}
        </TouchableOpacity>
        {hasChildren && (item.presentation ?? 'expand') === 'expand' && isExpanded
          ? item.children!.map((child, index) =>
              renderMenuRow(child, {
                nested: true,
                isLast: index === item.children!.length - 1,
              }),
            )
          : null}
      </View>
    );
  };

  if (!mounted) return null;

  return (
    <Modal visible={mounted} animationType="none" transparent onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.container}>
        <Animated.View
          pointerEvents="none"
          style={[styles.overlay, overlayStyle, { backgroundColor: theme.overlay }]}
        />

        <GestureDetector gesture={panGesture}>
          <Animated.View
            style={[
              styles.panel,
              nativeElevation(3),
              drawerStyle,
              {
                width: panelWidth,
                top: Math.max(insets.top, 8) + 4,
                bottom: Math.max(insets.bottom, 8) + 8,
                backgroundColor: theme.background,
              },
            ]}
          >
            <View style={[styles.panelBody, { width: contentWidth }]}>
              <Animated.View
                style={[
                  styles.slideRow,
                  { width: contentWidth * 2 },
                  contentSlideStyle,
                ]}
              >
                <ScrollView
                  style={[styles.scroll, { width: contentWidth }]}
                  contentContainerStyle={styles.scrollContent}
                  showsVerticalScrollIndicator={false}
                  scrollEnabled={settingsView === 'main'}
                >
            <View style={[styles.heroCard, { backgroundColor: roleColor }]}>
              <TouchableOpacity
                style={[styles.headerActionBtn, { backgroundColor: headerBtnBg }]}
                onPress={onClose}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="Back"
              >
                <MobileIcon name="chevron-left" size={20} color={tokens.colors.primary} weight="bold" />
              </TouchableOpacity>
              <View style={styles.heroLogoWrap} pointerEvents="none">
                <MobileNestykLogo
                  variant={isGuestHeader ? 'wordmarkOnYellow' : 'wordmarkOnDark'}
                  height={30}
                />
              </View>
              <View style={styles.headerActionBtn} />
            </View>

            <View style={[styles.identityCard, nativeElevation(1), { backgroundColor: theme.card }]}>
            {isAuthenticated ? (
              <TouchableOpacity
                style={styles.profileCard}
                onPress={() => openSubView('profile')}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={t.mobile.account.editProfile}
              >
                <View style={[styles.profileDecor, { opacity: decorOpacity }]} pointerEvents="none">
                  <View style={[styles.profileDecorRing, styles.profileDecorRingLg, { borderColor: decorRingColor }]} />
                  <View style={[styles.profileDecorRing, styles.profileDecorRingMd, { borderColor: decorRingColor }]} />
                  <View style={[styles.profileDecorRing, styles.profileDecorRingSm, { borderColor: decorRingColor }]} />
                </View>
                <MobileProfileAvatar initials={initials} size="md" />
                <View style={styles.profileText}>
                  <Text style={[styles.profileName, { color: theme.textHeading }]}>{userName}</Text>
                  <Text style={[styles.profileSub, { color: theme.textSecondary }]}>
                    {t.mobile.account.editProfile}
                  </Text>
                </View>
                <MobileIcon name="chevron-right" size={18} color={mutedIcon} />
              </TouchableOpacity>
            ) : (
              <View style={styles.signInWrap}>
                <MobileButton onPress={handleSignOut} style={styles.signInButton}>
                  {t.common.signIn}
                </MobileButton>
              </View>
            )}

            {isAuthenticated ? (
              <TouchableOpacity
                style={[styles.currentRoleRow, { borderTopColor: theme.border }]}
                onPress={() => setRolePickerOpen(true)}
                disabled={visibleRoleOptions.length < 2}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`${t.mobile.profile.role}: ${t.roles[activeRole]}`}
                accessibilityState={{ expanded: rolePickerOpen, disabled: visibleRoleOptions.length < 2 }}
              >
                <View style={[styles.roleIconBox, { backgroundColor: roleIconTint(activeRole, isDark) }]}>
                  <MobileIcon
                    name={ROLE_OPTIONS.find((role) => role.key === activeRole)!.icon}
                    size={20}
                    color={activeRole === 'admin' ? theme.textHeading : roleColor}
                  />
                </View>
                <View style={styles.profileText}>
                  <Text style={[styles.profileSub, { color: theme.textSecondary }]}>{t.mobile.profile.role}</Text>
                  <Text style={[styles.roleChipLabel, { color: theme.textHeading }]}>{t.roles[activeRole]}</Text>
                </View>
                {visibleRoleOptions.length > 1 && (
                  <MobileIcon name="swap" size={20} color={mutedIcon} />
                )}
              </TouchableOpacity>
            ) : null}
            </View>

            {drawerSections.map((section) => (
              <View key={section.titleKey ?? 'workspace'}>
                <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                  {t.mobile.drawerMenu[section.titleKey ?? 'sectionTitle']}
                </Text>
                <View style={[styles.settingsCard, nativeElevation(1), { backgroundColor: theme.card }]}>
                  {section.items.map((item, index) =>
                    renderMenuRow(item, { isLast: index === section.items.length - 1 }),
                  )}
                </View>
              </View>
            ))}

            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
              {t.mobile.profile.settings}
            </Text>
            <View style={[styles.settingsCard, nativeElevation(1), { backgroundColor: theme.card }]}>
              <View style={styles.settingRow}>
                <MobileIcon name="moon" size={20} color={mutedIcon} />
                <Text style={[styles.navLabel, { color: theme.textHeading }]}>
                  {t.mobile.settings.darkMode}
                </Text>
                <Switch
                  value={themeMode === 'dark'}
                  onValueChange={(value) => setThemeMode(value ? 'dark' : 'light')}
                  trackColor={{ false: theme.border, true: tokens.colors.roles.tenant }}
                  thumbColor="#FFFFFF"
                />
              </View>
              <TouchableOpacity
                style={[styles.settingRow, styles.settingRowBorder, { borderTopColor: theme.border }]}
                onPress={() => openSubView('language')}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={t.mobile.settings.language}
              >
                <MobileIcon name="globe" size={20} color={mutedIcon} />
                <Text style={[styles.navLabel, { color: theme.textHeading }]}>
                  {t.mobile.settings.language}
                </Text>
                <Text style={[styles.settingValue, { color: theme.textSecondary }]}>
                  {currentLanguageLabel}
                </Text>
                <MobileIcon name="chevron-right" size={18} color={mutedIcon} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.settingRow, styles.settingRowBorder, { borderTopColor: theme.border }]}
                onPress={() => openSubView('account')}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={t.mobile.profile.accountSettings}
              >
                <MobileIcon name="gear" size={20} color={mutedIcon} />
                <Text style={[styles.navLabel, { color: theme.textHeading }]}>
                  {t.mobile.profile.accountSettings}
                </Text>
                <MobileIcon name="chevron-right" size={18} color={mutedIcon} />
              </TouchableOpacity>
            </View>
              </ScrollView>

              <View style={[styles.subPane, { width: contentWidth, backgroundColor: theme.background }]}>
                <View style={styles.subHeader}>
                  <TouchableOpacity
                    style={[styles.subBackBtn, { backgroundColor: isDark ? theme.card : '#FFFFFF' }]}
                    onPress={handleSubBack}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityLabel="Back"
                  >
                    <MobileIcon name="chevron-left" size={20} color={theme.textHeading} />
                  </TouchableOpacity>
                  <Text style={[styles.subTitle, { color: theme.textHeading }]}>{subViewTitle}</Text>
                </View>

                {settingsView === 'profile' ? (
                  <MobileProfileEditBody
                    initials={initials}
                    name={userName}
                    email={userEmail}
                    phone={userPhone}
                  />
                ) : settingsView === 'language' ? (
                  <MobileLanguagePickerBody onSelect={() => closeSubView()} />
                ) : settingsView === 'account' ? (
                  <MobileAccountSettingsBody
                    ref={accountRef}
                    profile={{
                      name: userName,
                      initials,
                      email: userEmail,
                      phone: userPhone,
                    }}
                    appVersion="0.1.0"
                    onSignOut={handleSignOut}
                    signOutLabel={signOutLabel}
                    onNestedViewChange={handleAccountNestedChange}
                  />
                ) : settingsView === 'roleMenu' && submenuParent?.children ? (
                  <View style={[styles.languageList, nativeElevation(1), { backgroundColor: theme.card }]}>
                    {submenuParent.children.map((child, index) => {
                      const isLast = index === submenuParent.children!.length - 1;
                      return (
                        <TouchableOpacity
                          key={child.id}
                          style={[
                            styles.settingRow,
                            !isLast && { borderBottomWidth: 1, borderBottomColor: theme.border },
                          ]}
                          onPress={() => dispatchMenuAction(child.action)}
                          activeOpacity={0.75}
                          accessibilityRole="button"
                          accessibilityLabel={t.mobile.drawerMenu[child.labelKey]}
                        >
                          <MobileIcon name={child.icon} size={20} color={roleColor} />
                          <Text style={[styles.navLabel, { color: theme.textHeading }]}>
                            {t.mobile.drawerMenu[child.labelKey]}
                          </Text>
                          <MobileIcon name="chevron-right" size={18} color={mutedIcon} />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            </Animated.View>
          </View>
          </Animated.View>
        </GestureDetector>
        <MobileBottomSheet
          visible={rolePickerOpen && isAuthenticated}
          onClose={() => setRolePickerOpen(false)}
          maxHeight="85%"
        >
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHeaderText}>
              <Text accessibilityRole="header" style={[styles.sheetTitle, { color: theme.textHeading }]}>
                {t.mobile.profile.role}
              </Text>
              <Text style={[styles.sheetSubtitle, { color: theme.textSecondary }]}>
                {t.mobile.profile.rolePickerSubtitle}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.sheetClose}
              onPress={() => setRolePickerOpen(false)}
              accessibilityRole="button"
              accessibilityLabel={t.common.cancel}
            >
              <MobileIcon name="close" size={20} color={theme.textHeading} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.roleList}>
            {visibleRoleOptions.map((role) => {
              const isActive = role.key === activeRole;
              const optionColor = tokens.colors.roles[role.key] || tokens.colors.brand[500];
              return (
                <View key={role.key} style={role.key === 'admin' ? [styles.adminRole, { borderTopColor: theme.border }] : undefined}>
                  <TouchableOpacity
                    style={[
                      styles.roleOption,
                      {
                        borderColor: isActive ? BRAND_YELLOW : theme.border,
                        backgroundColor: isActive ? brandSoft : theme.card,
                      },
                    ]}
                    onPress={() => {
                      setRolePickerOpen(false);
                      if (!isActive) onRoleChange(role.key);
                    }}
                    activeOpacity={0.7}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isActive }}
                    aria-checked={isActive}
                    accessibilityLabel={`${t.roles[role.key]}. ${t.mobile.profile.roleDescriptions[role.key]}`}
                  >
                    <View style={[styles.roleIconBoxLg, { backgroundColor: roleIconTint(role.key, isDark) }]}>
                      <MobileIcon
                        name={role.icon}
                        size={22}
                        color={role.key === 'admin' ? theme.textHeading : optionColor}
                      />
                    </View>
                    <View style={styles.profileText}>
                      <Text style={[styles.roleOptionTitle, { color: theme.textHeading }]}>{t.roles[role.key]}</Text>
                      <Text style={[styles.profileSub, { color: theme.textSecondary }]}>{t.mobile.profile.roleDescriptions[role.key]}</Text>
                    </View>
                    {isActive && <SelectionCheck selected variant="row" size="md" />}
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>
        </MobileBottomSheet>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  languageList: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  container: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  panel: {
    position: 'absolute',
    left: PANEL_MARGIN,
    borderRadius: PANEL_RADIUS,
    overflow: 'hidden',
  },
  panelBody: {
    flex: 1,
    marginHorizontal: 14,
    overflow: 'hidden',
  },
  slideRow: {
    flexDirection: 'row',
    flex: 1,
  },
  scroll: {
    flex: 1,
    borderRadius: PANEL_RADIUS,
  },
  scrollContent: {
    paddingTop: 10,
    paddingBottom: 28,
  },
  heroCard: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  heroLogoWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  identityCard: {
    borderRadius: 16,
    marginBottom: 6,
    overflow: 'hidden',
  },
  signInWrap: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
  },
  signInButton: {
    width: '100%',
    borderRadius: 10,
    paddingVertical: 13,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    overflow: 'hidden',
  },
  profileDecor: {
    position: 'absolute',
    right: -36,
    top: -48,
    width: 140,
    height: 140,
  },
  profileDecorRing: {
    position: 'absolute',
    borderWidth: 1.5,
    borderRadius: 999,
  },
  profileDecorRingLg: {
    width: 140,
    height: 140,
    right: 0,
    top: 0,
  },
  profileDecorRingMd: {
    width: 104,
    height: 104,
    right: 18,
    top: 18,
  },
  profileDecorRingSm: {
    width: 68,
    height: 68,
    right: 36,
    top: 36,
  },
  profileText: {
    flex: 1,
  },
  profileName: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 17,
    lineHeight: 26,
    fontWeight: '600',
    color: tokens.colors.textHeading,
  },
  profileSub: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 19,
    color: tokens.colors.textSecondary,
    marginTop: 2,
  },
  sectionLabel: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    color: tokens.colors.textSecondary,
    marginBottom: 10,
    marginTop: 16,
  },
  currentRoleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    minHeight: 72,
  },
  roleIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleIconBoxLg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 12,
  },
  sheetHeaderText: {
    flex: 1,
    paddingRight: 8,
    paddingTop: 6,
  },
  sheetTitle: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 18,
    lineHeight: 27,
    fontWeight: '600',
  },
  sheetSubtitle: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
  },
  sheetClose: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleList: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 10,
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 76,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  roleOptionTitle: {
    fontFamily: tokens.typography.native.body,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  adminRole: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 14,
    marginTop: 4,
  },
  roleChipLabel: {
    fontFamily: tokens.typography.native.body,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    color: tokens.colors.textHeading,
  },
  navLabel: {
    flex: 1,
    fontFamily: tokens.typography.native.body,
    fontSize: 15,
    lineHeight: 22,
    color: tokens.colors.textHeading,
    fontWeight: '500',
  },
  settingsCard: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    gap: 12,
  },
  menuNestedRow: {
    paddingLeft: 16,
  },
  settingRowBorder: {
    borderTopWidth: 1,
  },
  settingValue: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 19,
    marginRight: 2,
  },
  subPane: {
    paddingTop: 10,
    flex: 1,
  },
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
    paddingTop: 4,
  },
  subBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subTitle: {
    flex: 1,
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
});
