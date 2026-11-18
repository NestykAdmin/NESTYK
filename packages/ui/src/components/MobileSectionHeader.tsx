import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import { MobileIcon } from '../icons/MobileIcon';
import type { AppIconName } from '../icons/types';
import { roleOnDark, tokens } from '../theme/tokens';
import { useMobileTheme } from '../theme/ThemeContext';

export interface MobileSectionHeaderProps {
  /** Primary page title (shown once — do not repeat in body). */
  title: string;
  /** Passive role / workspace label under the title */
  workspaceLabel?: string;
  accentColor?: string;
  /** Main tabs: menu. Secondary flows (e.g. create listing): back. */
  leading?: 'menu' | 'back';
  onMenuPress?: () => void;
  onBackPress?: () => void;
  backDisabled?: boolean;
  /** Compact brand CTA (e.g. Rooms / Leads add) */
  onAddPress?: () => void;
  /** `label` = “+ Add”; `room` / `lead` = outline icon button */
  addVariant?: 'label' | 'room' | 'lead';
  addLabel?: string;
  addAccessibilityLabel?: string;
  /**
   * Trailing action (e.g. Edit room / Edit lead).
   * `solid` = brand pill with label; `icon` = outline square matching `addVariant="room"`.
   */
  onActionPress?: () => void;
  actionLabel?: string;
  /** Icon for `actionVariant="icon"` (default `note`). */
  actionIcon?: AppIconName;
  actionVariant?: 'solid' | 'icon';
  actionDisabled?: boolean;
  /** When set, shows search affordance on the right */
  onSearchPress?: () => void;
  searchActive?: boolean;
  searchAccessibilityLabel?: string;
}

/**
 * List / hub / secondary header for Agent (and later Owner).
 * Overview brand logo stays on `MobileWorkspaceHeader` only.
 */
export const MobileSectionHeader: React.FC<MobileSectionHeaderProps> = ({
  title,
  workspaceLabel,
  accentColor = tokens.colors.roles.agent,
  leading = 'menu',
  onMenuPress,
  onBackPress,
  backDisabled = false,
  onAddPress,
  addVariant = 'label',
  addLabel = 'Add',
  addAccessibilityLabel,
  onActionPress,
  actionLabel,
  actionIcon = 'note',
  actionVariant = 'solid',
  actionDisabled = false,
  onSearchPress,
  searchActive = false,
  searchAccessibilityLabel = 'Search',
}) => {
  const { theme, isDark } = useMobileTheme();
  const ink = theme.screenTitle || tokens.colors.primary;
  const isBack = leading === 'back';
  const showAction = Boolean(onActionPress && actionLabel);
  const hasTrailing = Boolean(onAddPress || onSearchPress || showAction);
  const isIconAdd = addVariant === 'room' || addVariant === 'lead';
  const addIconName: AppIconName = addVariant === 'lead' ? 'user-plus' : 'house-plus';
  const isIconAction = actionVariant === 'icon';

  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={[styles.iconBtn, backDisabled ? styles.iconBtnDisabled : null]}
        onPress={isBack ? onBackPress : onMenuPress}
        disabled={isBack ? backDisabled : false}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={isBack ? 'Back' : 'Menu'}
        accessibilityState={{ disabled: isBack ? backDisabled : false }}
        {...(Platform.OS === 'android'
          ? { android_ripple: { color: 'rgba(0,0,0,0.08)', borderless: true, radius: 22 } }
          : {})}
      >
        <MobileIcon name={isBack ? 'chevron-left' : 'menu'} size={22} color={ink} />
      </TouchableOpacity>

      <View style={styles.titleBlock} accessibilityRole="header">
        <View style={styles.primaryLine}>
          <Text style={[styles.title, { color: ink }]} numberOfLines={1}>
            {title}
          </Text>
        </View>
        {workspaceLabel ? (
          <View style={styles.workspaceRow}>
            <View style={[styles.rule, { backgroundColor: roleOnDark(accentColor, isDark) }]} />
            <Text
              style={[styles.workspaceLabel, { color: ink }]}
              numberOfLines={1}
              accessibilityRole="text"
            >
              {workspaceLabel}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.trailingSlot}>
        {hasTrailing ? (
          <View style={styles.trailing}>
            {onAddPress ? (
              <Pressable
                style={({ pressed }) => [
                  styles.addBtn,
                  isIconAdd && styles.outlineIconBtn,
                  pressed && (isIconAdd ? styles.outlineIconBtnPressed : { opacity: 0.85 }),
                ]}
                onPress={onAddPress}
                accessibilityRole="button"
                accessibilityLabel={addAccessibilityLabel ?? addLabel}
                {...(Platform.OS === 'android'
                  ? { android_ripple: { color: 'rgba(33,30,30,0.12)' } }
                  : {})}
              >
                {isIconAdd ? (
                  <MobileIcon name={addIconName} size={24} color={tokens.colors.primary} />
                ) : (
                  <Text style={styles.addLabel} numberOfLines={1}>
                    {`+ ${addLabel}`}
                  </Text>
                )}
              </Pressable>
            ) : null}
            {showAction ? (
              <Pressable
                style={({ pressed }) => [
                  isIconAction ? styles.outlineIconBtn : styles.actionBtn,
                  actionDisabled ? styles.actionBtnDisabled : null,
                  pressed && !actionDisabled
                    ? isIconAction
                      ? styles.outlineIconBtnPressed
                      : { opacity: 0.85 }
                    : null,
                ]}
                onPress={onActionPress}
                disabled={actionDisabled}
                accessibilityRole="button"
                accessibilityLabel={actionLabel}
                accessibilityState={{ disabled: actionDisabled }}
                {...(Platform.OS === 'android'
                  ? { android_ripple: actionDisabled ? undefined : { color: 'rgba(33,30,30,0.12)' } }
                  : {})}
              >
                {isIconAction ? (
                  <MobileIcon name={actionIcon} size={22} color={tokens.colors.primary} />
                ) : (
                  <Text style={styles.actionLabel} numberOfLines={1}>
                    {actionLabel}
                  </Text>
                )}
              </Pressable>
            ) : null}
            {onSearchPress ? (
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={onSearchPress}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={searchAccessibilityLabel}
                accessibilityState={{ selected: searchActive }}
                {...(Platform.OS === 'android'
                  ? { android_ripple: { color: 'rgba(0,0,0,0.08)', borderless: true, radius: 22 } }
                  : {})}
              >
                <MobileIcon
                  name={searchActive ? 'close' : 'search'}
                  size={22}
                  color={searchActive ? tokens.colors.brand[500] : ink}
                />
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          <View style={styles.iconBtn} />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    minHeight: 56,
    gap: 8,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 4,
    justifyContent: 'center',
  },
  primaryLine: {
    minHeight: 30,
    justifyContent: 'center',
  },
  title: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 20,
    lineHeight: 30,
    fontWeight: '500',
  },
  workspaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 18,
  },
  rule: {
    width: 2,
    height: 12,
    borderRadius: 1,
  },
  workspaceLabel: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  trailingSlot: {
    minWidth: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnDisabled: {
    opacity: 0.4,
  },
  addBtn: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: tokens.colors.brand[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Shared outline icon CTA — room list Add + detail Edit */
  outlineIconBtn: {
    width: 44,
    height: 44,
    minHeight: 44,
    paddingHorizontal: 0,
    borderRadius: 12,
    backgroundColor: tokens.colors.white,
    borderWidth: 1,
    borderColor: tokens.colors.brand[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineIconBtnPressed: {
    backgroundColor: tokens.colors.brand[100],
  },
  addLabel: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '700',
    color: tokens.colors.primary,
  },
  actionBtn: {
    minHeight: 36,
    maxWidth: 140,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: tokens.colors.brand[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnDisabled: {
    opacity: 0.45,
  },
  actionLabel: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '700',
    color: tokens.colors.primary,
  },
});
