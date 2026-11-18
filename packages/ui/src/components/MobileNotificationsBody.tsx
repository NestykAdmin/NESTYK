import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useLocale, SupportedLocale } from '@nestyk/i18n';
import { MobileIcon } from '../icons/MobileIcon';
import { AppIconName } from '../icons/types';
import { useMobileTheme } from '../theme/ThemeContext';
import { tokens } from '../theme/tokens';

export interface MobileNotificationItem {
  id: string;
  text: string;
  time: string;
  unread: boolean;
  icon: AppIconName;
  iconColor: string;
}

export interface MobileNotificationsBodyProps {
  activityItems: MobileNotificationItem[];
  messageItems: MobileNotificationItem[];
  onClearAll?: () => void;
  onBack?: () => void;
  /** Shown when the selected list is empty */
  emptyLabel?: string;
}

export const MobileNotificationsBody: React.FC<MobileNotificationsBodyProps> = ({
  activityItems,
  messageItems,
  onClearAll,
  onBack,
  emptyLabel,
}) => {
  const { t } = useLocale();
  const { theme, isDark } = useMobileTheme();
  const [segment, setSegment] = useState<'activity' | 'messages'>('activity');
  const items = segment === 'activity' ? activityItems : messageItems;

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <MobileIcon name="chevron-left" size={24} color={theme.textHeading} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.textHeading }]}>
          {t.mobile.notifications.title}
        </Text>
        <TouchableOpacity onPress={onClearAll} style={styles.trashBtn}>
          <MobileIcon name="trash" size={22} tone="danger" />
        </TouchableOpacity>
      </View>

      <View style={[styles.segment, { backgroundColor: isDark ? '#334155' : '#F1F5F9' }]}>
        <TouchableOpacity
          style={[
            styles.segmentBtn,
            segment === 'activity' && {
              backgroundColor: isDark ? theme.card : tokens.colors.slate[900],
            },
          ]}
          onPress={() => setSegment('activity')}
        >
          <Text
            style={[
              styles.segmentText,
              { color: theme.textSecondary },
              segment === 'activity' && styles.segmentTextActive,
            ]}
          >
            {t.mobile.notifications.activity}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.segmentBtn,
            segment === 'messages' && {
              backgroundColor: isDark ? theme.card : tokens.colors.slate[900],
            },
          ]}
          onPress={() => setSegment('messages')}
        >
          <Text
            style={[
              styles.segmentText,
              { color: theme.textSecondary },
              segment === 'messages' && styles.segmentTextActive,
            ]}
          >
            {t.mobile.notifications.messages}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {items.length === 0 && emptyLabel ? (
          <Text style={[styles.empty, { color: theme.textSecondary }]}>{emptyLabel}</Text>
        ) : null}
        {items.map((item) => (
          <View
            key={item.id}
            style={[
              styles.row,
              { borderBottomColor: theme.border },
              item.unread && { backgroundColor: isDark ? '#211E1E' : '#F8FAFC' },
            ]}
          >
            <View style={[styles.iconCircle, { backgroundColor: `${item.iconColor}18` }]}>
              <MobileIcon name={item.icon} size={20} color={item.iconColor} weight="regular" />
            </View>
            <View style={styles.rowContent}>
              <Text style={[styles.rowText, { color: theme.textHeading }]}>{item.text}</Text>
              <Text style={[styles.rowTime, { color: theme.textSecondary }]}>{item.time}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  empty: { fontFamily: tokens.typography.native.body, fontSize: 14, lineHeight: 21, textAlign: 'center', paddingVertical: 32, paddingHorizontal: 20 },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 18,
    lineHeight: 27,
    fontWeight: '500',
  },
  trashBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segment: {
    flexDirection: 'row',
    margin: 16,
    borderRadius: 12,
    padding: 4,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  segmentText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    fontWeight: '500',
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  list: {
    flex: 1,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowContent: {
    flex: 1,
    gap: 4,
  },
  rowText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '400',
  },
  rowTime: {
    fontFamily: tokens.typography.native.body,
    fontSize: 11,
    lineHeight: 16,
  },
});
