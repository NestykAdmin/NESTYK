import React, { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import type { AppIconName } from '@nestyk/ui/native';
import { MobileIcon, tokens } from '@nestyk/ui/native';

export type RoomEditSectionStatus = 'complete' | 'incomplete' | 'empty' | 'stale';

export type RoomEditSectionGroup = 'room' | 'listing';

export type RoomEditSection = {
  step: number;
  icon: AppIconName;
  label: string;
  hint: string;
  status: RoomEditSectionStatus;
  /** Short status line, e.g. "2 fields missing" or "Not added yet". */
  statusLabel: string;
  /** After Save room — draw attention to required gaps on the hub. */
  highlightError?: boolean;
  /** Topic group for hub list headers (design B). */
  group?: RoomEditSectionGroup;
};

export type RoomEditNextSection = {
  step: number;
  label: string;
  reason: string;
};

export interface RoomEditSectionListProps {
  sections: RoomEditSection[];
  themeColor?: string;
  summaryLabel: string;
  summaryTone: 'success' | 'warning' | 'error';
  /** 0–1 overall section completeness (not save-required only). */
  progress?: number;
  /** Line under progress — next action or save-ready hint. */
  encouragement?: string;
  /** Guided next action card; omit when hub is fully complete. */
  nextSection?: RoomEditNextSection | null;
  nextTitle?: string;
  groupLabels?: Partial<Record<RoomEditSectionGroup, string>>;
  disabled?: boolean;
  onSelect: (step: number) => void;
}

const ICON_BG = '#F1F5F9';
const ICON_FG = '#64748B';
const BRAND = tokens.colors.brand[500];
const NEXT_BG = '#FFFBEB';
const NEXT_BORDER = '#F8B615';
const DONUT_SIZE = 64;
const DONUT_STROKE = 7;
const DONUT_R = (DONUT_SIZE - DONUT_STROKE) / 2;
const DONUT_C = 2 * Math.PI * DONUT_R;

function ProgressDonut({
  progress,
  tone,
}: {
  progress: number;
  tone: 'success' | 'warning' | 'error';
}) {
  const fill = Math.max(0, Math.min(1, progress));
  const color =
    tone === 'error'
      ? tokens.colors.error
      : tone === 'success'
        ? tokens.colors.success
        : BRAND;
  const percent = Math.round(fill * 100);

  return (
    <View
      style={styles.donutWrap}
      accessibilityRole="progressbar"
      accessibilityValue={{ now: percent, min: 0, max: 100 }}
    >
      <Svg width={DONUT_SIZE} height={DONUT_SIZE}>
        <Circle
          cx={DONUT_SIZE / 2}
          cy={DONUT_SIZE / 2}
          r={DONUT_R}
          stroke="#F1F5F9"
          strokeWidth={DONUT_STROKE}
          fill="none"
        />
        <Circle
          cx={DONUT_SIZE / 2}
          cy={DONUT_SIZE / 2}
          r={DONUT_R}
          stroke={color}
          strokeWidth={DONUT_STROKE}
          fill="none"
          strokeDasharray={`${DONUT_C} ${DONUT_C}`}
          strokeDashoffset={DONUT_C * (1 - fill)}
          strokeLinecap="round"
          transform={`rotate(-90 ${DONUT_SIZE / 2} ${DONUT_SIZE / 2})`}
        />
      </Svg>
      <Text style={styles.donutPercent}>{percent}%</Text>
    </View>
  );
}

function StatusTrailing({
  status,
  highlightError,
}: {
  status: RoomEditSectionStatus;
  highlightError?: boolean;
}) {
  if (status === 'complete') {
    return (
      <View style={styles.completeBadge} accessibilityRole="image">
        <MobileIcon name="check" size={12} color={tokens.colors.white} weight="bold" />
      </View>
    );
  }
  if (status === 'stale') {
    return (
      <View style={styles.warnBadge} accessibilityRole="image">
        <MobileIcon name="warning" size={14} color={tokens.colors.white} weight="bold" />
      </View>
    );
  }
  if (status === 'incomplete' || highlightError) {
    return (
      <View style={styles.warnBadge} accessibilityRole="image">
        <Text style={styles.warnMark}>!</Text>
      </View>
    );
  }
  return <View style={styles.emptyBadge} accessibilityRole="image" />;
}

export const RoomEditSectionList: React.FC<RoomEditSectionListProps> = ({
  sections,
  summaryLabel,
  summaryTone,
  progress,
  encouragement,
  nextSection,
  nextTitle,
  groupLabels,
  disabled,
  onSelect,
}) => {
  const fill = Math.max(0, Math.min(1, progress ?? (summaryTone === 'success' ? 1 : 0.35)));

  const grouped = useMemo(() => {
    const hasGroups = sections.some((s) => s.group);
    if (!hasGroups) {
      return [{ key: 'all' as const, label: null as string | null, items: sections }];
    }
    const order: RoomEditSectionGroup[] = ['room', 'listing'];
    return order
      .map((key) => ({
        key,
        label: groupLabels?.[key] ?? null,
        items: sections.filter((s) => s.group === key),
      }))
      .filter((g) => g.items.length > 0);
  }, [sections, groupLabels]);

  return (
    <View style={styles.wrap}>
      <View style={styles.progressCard}>
        <View style={styles.progressRow}>
          <ProgressDonut progress={fill} tone={summaryTone} />
          <View style={styles.progressCopy}>
            <Text style={styles.progressLabel}>{summaryLabel}</Text>
            {encouragement ? <Text style={styles.encouragement}>{encouragement}</Text> : null}
          </View>
        </View>
      </View>

      {nextSection ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${nextTitle ?? 'Next'}: ${nextSection.label}. ${nextSection.reason}`}
          disabled={disabled}
          onPress={() => onSelect(nextSection.step)}
          android_ripple={{ color: `${BRAND}33` }}
          style={({ pressed }) => [
            styles.nextCard,
            pressed && Platform.OS === 'ios' ? { opacity: 0.88 } : null,
          ]}
        >
          <View style={styles.nextCopy}>
            <Text style={styles.nextTitle}>
              {nextTitle ? `${nextTitle}: ${nextSection.label}` : nextSection.label}
            </Text>
            <Text style={styles.nextReason} numberOfLines={2}>
              {nextSection.reason}
            </Text>
          </View>
          <MobileIcon name="chevron-right" size={20} color={BRAND} />
        </Pressable>
      ) : null}

      {grouped.map((group) => (
        <View key={group.key} style={styles.groupBlock}>
          {group.label ? <Text style={styles.groupLabel}>{group.label}</Text> : null}
          <View style={styles.groupCard}>
            {group.items.map((section, index) => (
              <Pressable
                key={section.step}
                accessibilityRole="button"
                accessibilityLabel={`${section.label}. ${section.statusLabel}`}
                disabled={disabled}
                onPress={() => onSelect(section.step)}
                android_ripple={{ color: `${BRAND}22` }}
                style={({ pressed }) => [
                  styles.row,
                  index > 0 ? styles.rowDivider : null,
                  section.highlightError ? styles.rowError : null,
                  pressed && Platform.OS === 'ios' ? { opacity: 0.72 } : null,
                ]}
              >
                <View style={[styles.iconWrap, section.highlightError ? styles.iconWrapError : null]}>
                  <MobileIcon
                    name={section.icon}
                    size={20}
                    color={section.highlightError ? tokens.colors.error : ICON_FG}
                  />
                </View>
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle}>{section.label}</Text>
                  <Text
                    style={[
                      styles.rowHint,
                      section.highlightError || section.status === 'stale'
                        ? styles.rowHintError
                        : null,
                    ]}
                    numberOfLines={2}
                  >
                    {section.status === 'complete' ? section.hint : section.statusLabel}
                  </Text>
                </View>
                <StatusTrailing status={section.status} highlightError={section.highlightError} />
                <MobileIcon
                  name="chevron-right"
                  size={18}
                  color={section.highlightError ? tokens.colors.error : tokens.colors.divider}
                />
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    gap: 16,
  },
  progressCard: {
    backgroundColor: tokens.colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  donutWrap: {
    width: DONUT_SIZE,
    height: DONUT_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutPercent: {
    position: 'absolute',
    fontFamily: tokens.typography.native.body,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
    color: tokens.colors.textHeading,
  },
  progressCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  progressLabel: {
    fontFamily: tokens.typography.native.body,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    color: tokens.colors.textHeading,
  },
  encouragement: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    color: tokens.colors.textSecondary,
  },
  nextCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 72,
    backgroundColor: NEXT_BG,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: NEXT_BORDER,
  },
  nextCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  nextTitle: {
    fontFamily: tokens.typography.native.body,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
    color: '#211E1E',
  },
  nextReason: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    color: tokens.colors.textSecondary,
  },
  groupBlock: {
    gap: 8,
  },
  groupLabel: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '700',
    color: tokens.colors.textHeading,
    marginTop: 4,
  },
  groupCard: {
    backgroundColor: tokens.colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 72,
    backgroundColor: tokens.colors.white,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.colors.border,
  },
  rowError: {
    backgroundColor: '#FEF2F2',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ICON_BG,
  },
  iconWrapError: {
    backgroundColor: '#FEF2F2',
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowTitle: {
    fontFamily: tokens.typography.native.body,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    color: tokens.colors.textHeading,
  },
  rowHint: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    color: tokens.colors.textSecondary,
  },
  rowHintError: {
    color: tokens.colors.error,
    fontWeight: '600',
  },
  completeBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.success,
  },
  warnBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.warning,
  },
  warnMark: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '800',
    color: tokens.colors.white,
  },
  emptyBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: tokens.colors.divider,
    backgroundColor: 'transparent',
  },
});
