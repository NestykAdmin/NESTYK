import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { AgentLead, LeadViewing } from '@nestyk/types';
import { useLocale } from '@nestyk/i18n';
import { getCardElevation, MobileIcon, tokens, useMobileTheme } from '@nestyk/ui/native';
import type { LeadRoomMatch } from '../lib/lead-match-preview';
import { LeadViewingSheet } from './LeadViewingSheet';
import { ViewingDateTile, type ViewingDateTileTone } from './ViewingDateTile';

const { boxShadow: _webShadow, ...cardShadow } = getCardElevation(1);

type RowStatus = 'upcoming' | 'overdue' | 'done' | 'cancelled';

/** The date tile carries the status: yellow upcoming, gray once the time has passed. */
const ROW_TILE: Record<RowStatus, ViewingDateTileTone> = {
  upcoming: 'upcoming',
  overdue: 'past',
  done: 'past',
  cancelled: 'cancelled',
};

function rowStatus(v: LeadViewing, now: number): RowStatus {
  if (v.status === 'cancelled') return 'cancelled';
  if (v.status === 'done') return 'done';
  return new Date(v.scheduledAt).getTime() > now ? 'upcoming' : 'overdue';
}

/** Upcoming first (soonest on top), then the rest newest first. */
function sortViewings(rows: LeadViewing[], now: number) {
  const time = (v: LeadViewing) => new Date(v.scheduledAt).getTime();
  const upcoming = rows.filter((v) => rowStatus(v, now) === 'upcoming').sort((a, b) => time(a) - time(b));
  const rest = rows.filter((v) => rowStatus(v, now) !== 'upcoming').sort((a, b) => time(b) - time(a));
  return [...upcoming, ...rest];
}

/** Rooms with a viewing that is not cancelled; they leave the suggestion list. */
export function viewedRoomIds(viewings: LeadViewing[]): Set<number> {
  return new Set(viewings.filter((v) => v.status !== 'cancelled').map((v) => v.rentRoomId));
}

/** Every viewing of the lead. A row opens the matched room, or the move/cancel sheet when the room is not in the match list. */
export function LeadViewingsSection({
  lead,
  viewings,
  matches,
  onOpenMatch,
  onSaved,
}: {
  lead: AgentLead;
  viewings: LeadViewing[];
  matches: LeadRoomMatch[];
  onOpenMatch?: (match: LeadRoomMatch) => void;
  onSaved: (viewing: LeadViewing) => void;
}) {
  const { t } = useLocale();
  const c = t.agent.leads.viewing;
  const { theme } = useMobileTheme();
  const [editing, setEditing] = useState<LeadViewing | null>(null);
  const closed = lead.status === 'booked' || lead.status === 'lost';
  const now = Date.now();

  if (!viewings.length) return null;

  return (
    <View style={styles.section}>
      <Text style={[styles.title, { color: theme.textHeading }]}>
        {c.listTitle.replace('{count}', String(viewings.length))}
      </Text>
      <View style={styles.list}>
        {sortViewings(viewings, now).map((v) => {
          const status = rowStatus(v, now);
          const match = matches.find((m) => m.room.id === v.rentRoomId);
          const onPress = match && onOpenMatch
            ? () => onOpenMatch(match)
            : status === 'upcoming' && !closed
              ? () => setEditing(v)
              : null;
          const statusLabel = c.statuses[status];
          const roomLine = v.roomNumber ? c.roomNumber.replace('{number}', v.roomNumber) : null;
          return (
            <Pressable
              key={v.id}
              disabled={!onPress}
              onPress={onPress ?? undefined}
              accessibilityRole={onPress ? 'button' : undefined}
              accessibilityLabel={[v.roomTitle, roomLine, statusLabel].filter(Boolean).join(', ')}
              style={({ pressed }) => [
                styles.row,
                cardShadow,
                { backgroundColor: theme.surface, borderColor: theme.border },
                status === 'cancelled' ? styles.faded : null,
                pressed && Platform.OS === 'ios' ? { opacity: 0.8 } : null,
              ]}
              android_ripple={onPress ? { color: 'rgba(33,30,30,0.08)' } : undefined}
            >
              <ViewingDateTile at={v.scheduledAt} tone={ROW_TILE[status]} />
              <View style={styles.main}>
                <Text style={[styles.roomTitle, { color: theme.textHeading }]} numberOfLines={2}>
                  {v.roomTitle}
                </Text>
                {roomLine ? (
                  <Text style={[styles.meta, { color: theme.textSecondary }]} numberOfLines={1}>
                    {roomLine}
                  </Text>
                ) : null}
                {v.note ? (
                  <Text style={[styles.meta, { color: theme.textSecondary }]} numberOfLines={1}>
                    {v.note}
                  </Text>
                ) : null}
              </View>
              {onPress ? <MobileIcon name="chevron-right" size={16} color={theme.textSecondary} /> : null}
            </Pressable>
          );
        })}
      </View>

      <LeadViewingSheet
        visible={!!editing}
        leadId={lead.id}
        roomId={editing?.rentRoomId ?? 0}
        viewing={editing}
        onClose={() => setEditing(null)}
        onSaved={(saved) => {
          setEditing(null);
          onSaved(saved);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  title: { fontFamily: tokens.typography.native.headingTh, fontSize: 16, lineHeight: 24 },
  list: { gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 10,
    overflow: Platform.OS === 'android' ? 'hidden' : 'visible',
  },
  faded: { opacity: 0.6 },
  main: { flex: 1, minWidth: 0, gap: 4 },
  roomTitle: { fontFamily: tokens.typography.native.bodyBold, fontSize: 15, lineHeight: 22 },
  meta: { flexShrink: 1, fontFamily: tokens.typography.native.body, fontSize: 12, lineHeight: 18 },
});
