import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { AgentLead, AgentTenant, LeadViewing, TenantLeadOption, TenantRoomOption } from '@nestyk/types';
import { useLocale } from '@nestyk/i18n';
import { MobileIcon, tokens, useMobileTheme, type AppIconName } from '@nestyk/ui/native';
import type { LeadRoomMatch } from '../lib/lead-match-preview';
import { LeadViewingSheet } from './LeadViewingSheet';
import { ReserveRoomSheet, type ReserveNext } from './ReserveRoomSheet';

/**
 * Bottom bar of a lead's matched room. Without a viewing: book one. With a viewing (past or
 * upcoming): edit/cancel it, or book the room for the client in a confirmation sheet on this page.
 * Once the lead has booked this room: open its tenant page.
 */
export function LeadRoomActions({
  lead,
  match,
  viewing,
  ready = true,
  onViewingSaved,
  onReserved,
  onContinue,
  onOpenTenant,
}: {
  lead: AgentLead;
  match: LeadRoomMatch;
  /** This room's scheduled viewing, from `useLeadRoomViewing`. */
  viewing: LeadViewing | null;
  /** False while viewings load, so the bar doesn't flip from "book" to "reserve". */
  ready?: boolean;
  onViewingSaved: (viewing: LeadViewing) => void;
  /** The room was booked: the lead is now `booked` and this is its tenant. */
  onReserved: (tenant: AgentTenant) => void;
  /** Chosen after booking: on to the reservation letter, or to the tenant page first. */
  onContinue: (tenant: AgentTenant, next: ReserveNext) => void;
  /** Opens the tenant page once this lead has booked this room. */
  onOpenTenant?: (tenantId: number) => void;
}) {
  const { t } = useLocale();
  const c = t.agent.leads.viewing;
  const { theme } = useMobileTheme();
  const [open, setOpen] = useState(false);
  const [reserving, setReserving] = useState(false);
  const closed = lead.status === 'booked' || lead.status === 'lost';
  const disabled = closed || !ready;
  const bookedTenantId = lead.status === 'booked' && lead.rentRoomId === match.room.id ? lead.tenantId : null;
  const reserveLead: TenantLeadOption = {
    id: lead.id,
    name: lead.name,
    firstName: lead.firstName,
    lastName: lead.lastName,
    phone: lead.phone,
    email: lead.email,
    nationality: lead.nationality,
  };
  // The match card has no room number; the sheet reads it, and who booked the room, when it opens.
  const reserveRoom: TenantRoomOption = {
    id: match.room.id,
    property: match.room.property?.name || match.room.listingTitle || '',
    room: null,
  };

  return (
    <View style={[styles.bar, { borderTopColor: theme.border }]}>
      {bookedTenantId && onOpenTenant ? (
        <BarButton
          icon="file-text"
          label={t.agent.leads.bookedOpenTenant}
          disabled={false}
          onPress={() => onOpenTenant(bookedTenantId)}
        />
      ) : viewing ? (
        <View style={styles.row}>
          <BarButton
            icon="pencil"
            label={c.manage}
            variant="outline"
            disabled={disabled}
            onPress={() => setOpen(true)}
            textColor={theme.textHeading}
            surface={theme.surface}
            inRow
          />
          <BarButton
            icon="check"
            label={c.reserve}
            disabled={disabled}
            onPress={() => setReserving(true)}
            inRow
          />
        </View>
      ) : (
        <BarButton icon="calendar" label={c.book} disabled={disabled} onPress={() => setOpen(true)} />
      )}

      <LeadViewingSheet
        visible={open}
        leadId={lead.id}
        roomId={match.room.id}
        viewing={viewing}
        onClose={() => setOpen(false)}
        onSaved={(saved) => {
          setOpen(false);
          onViewingSaved(saved);
        }}
      />
      <ReserveRoomSheet
        visible={reserving}
        lead={reserveLead}
        room={reserveRoom}
        onClose={() => setReserving(false)}
        onReserved={onReserved}
        onContinue={(tenant, next) => {
          setReserving(false);
          onContinue(tenant, next);
        }}
      />
    </View>
  );
}

function BarButton({
  icon,
  label,
  variant = 'solid',
  disabled,
  onPress,
  textColor = tokens.colors.primary,
  surface,
  inRow = false,
}: {
  icon: AppIconName;
  label: string;
  variant?: 'solid' | 'outline';
  disabled: boolean;
  onPress: () => void;
  textColor?: string;
  surface?: string;
  /** Share the row width; a lone button in the column bar must not flex or it grows tall. */
  inRow?: boolean;
}) {
  const outline = variant === 'outline';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.btn,
        inRow ? styles.rowItem : null,
        outline ? [styles.outline, { backgroundColor: surface }] : styles.solid,
        disabled ? styles.disabled : null,
        pressed && Platform.OS === 'ios' ? { opacity: 0.85 } : null,
      ]}
      android_ripple={{ color: outline ? tokens.colors.brand[100] : 'rgba(33,30,30,0.12)' }}
    >
      <MobileIcon name={icon} size={18} color={textColor} />
      <Text style={[styles.label, { color: textColor }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { paddingHorizontal: 16, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', gap: 10 },
  rowItem: { flex: 1 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 52,
    borderRadius: 14,
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  solid: { backgroundColor: tokens.colors.brand[500] },
  outline: { borderWidth: 1.5, borderColor: tokens.colors.brand[500] },
  disabled: { opacity: 0.5 },
  label: { flexShrink: 1, fontFamily: tokens.typography.native.headingTh, fontSize: 16, lineHeight: 24 },
});
