import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocale } from '@nestyk/i18n';
import { tokens, useMobileTheme } from '@nestyk/ui/native';
import { interpolate } from '@nestyk/feature-listing';
import { SELF_OWNER_LOCALE_TAG } from '../../lib/self-owner-dashboard';
import type { SelfOwnerRoom } from '../../lib/self-owner-rooms';

/** One room on the phone (self owner Dashboard and rooms list). The left edge says the room's state. */
export function MobileSelfOwnerRoomCard({
  room,
  testID,
  onPress,
}: {
  room: SelfOwnerRoom;
  testID?: string;
  /** Tap the card (rooms list: open the room detail, like the agent's phone list). */
  onPress?: () => void;
}) {
  const { t, locale } = useLocale();
  const { theme } = useMobileTheme();
  const copy = t.selfOwnerDashboard;
  const roomsCopy = t.selfOwnerRooms;
  const tag = SELF_OWNER_LOCALE_TAG[locale as keyof typeof SELF_OWNER_LOCALE_TAG] ?? SELF_OWNER_LOCALE_TAG.th;
  const ink = theme.screenTitle;
  const muted = theme.textSecondary;
  const accent = theme.mode === 'dark' ? tokens.colors.rolesOnDark.self_owner : tokens.colors.roles.self_owner;
  const edge = room.state === 'occupied' ? accent : room.state === 'listed' ? tokens.colors.icon.brand : theme.border;
  const money = new Intl.NumberFormat(tag, { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(room.monthlyRent);
  const leaseEnds = room.leaseEndsAt
    ? new Date(`${room.leaseEndsAt}T00:00:00+07:00`).toLocaleDateString(tag, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' })
    : null;

  const Card = onPress ? Pressable : View;
  const pressProps = onPress ? { onPress, accessibilityRole: 'button' as const, accessibilityLabel: `${roomsCopy.edit} ${room.title}` } : {};

  return (
    <Card testID={testID} {...pressProps} style={[styles.room, { borderColor: theme.border, borderLeftColor: edge }]}>
      <View style={styles.row}>
        <Text style={[styles.title, { color: ink }]} numberOfLines={1}>
          {room.title}
        </Text>
        <Text style={[styles.caption, { color: muted }]}>{copy.roomState[room.state]}</Text>
      </View>
      <Text style={[styles.caption, { color: muted }]} numberOfLines={1}>
        {room.project}
      </Text>
      <Text style={[styles.rent, { color: ink }]}>{interpolate(copy.perMonth, { amount: money })}</Text>
      {room.state === 'occupied' ? (
        <Text style={[styles.caption, { color: muted }]} numberOfLines={2}>
          {interpolate(copy.tenantLine, { name: room.tenantName ?? '' })}
          {leaseEnds ? `  ${interpolate(copy.leaseEnds, { date: leaseEnds })}` : ''}
        </Text>
      ) : room.state === 'listed' ? (
        <Text style={[styles.caption, { color: muted }]}>{interpolate(copy.interests, { n: room.interestCount ?? 0 })}</Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  room: { borderWidth: 1, borderLeftWidth: 4, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, minWidth: 0, fontFamily: tokens.typography.native.headingTh, fontSize: 15, lineHeight: 22, fontWeight: '500' },
  rent: { fontFamily: tokens.typography.native.headingTh, fontSize: 18, lineHeight: 26, fontWeight: '500', marginTop: 4 },
  caption: { fontFamily: tokens.typography.native.body, fontSize: 12, lineHeight: 18 },
});
