import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { ServiceCategory, ServiceStatus } from '@nestyk/types';
import { useLocale } from '@nestyk/i18n';
import { tokens, getCardElevation, MobileIcon, useMobileTheme } from '@nestyk/ui/native';
import type { AppIconName } from '@nestyk/ui';
import { UserRole } from '@nestyk/types';
import { ServiceHubActionId, serviceHubExtraTiles, servicesMatrix } from '../matrix';

export interface MobileServiceTicketItem {
  id: string;
  category: ServiceCategory;
  title: string;
  status: ServiceStatus;
  time: string;
  icon: AppIconName;
}

export interface MobileServiceCatalogBodyProps {
  currentRole: UserRole;
  onRequestService?: (category: ServiceCategory) => void;
  onHubAction?: (id: ServiceHubActionId) => void;
  activeTickets?: MobileServiceTicketItem[];
}

type HubTile = {
  key: string;
  title: string;
  icon: AppIconName;
  highlight?: boolean;
  badge?: number;
  onPress: () => void;
};

type ServiceLabelKey = 'viewing' | 'cleaning' | 'repair' | 'inspection' | 'support';

const SERVICE_LABEL_KEY: Record<ServiceCategory, ServiceLabelKey> = {
  viewing: 'viewing',
  cleaning: 'cleaning',
  maintenance: 'repair',
  inspection: 'inspection',
  support: 'support',
};

const EXTRA_LABEL_KEY: Record<ServiceHubActionId, 'myTickets' | 'emergency' | 'moveIn'> = {
  tickets: 'myTickets',
  emergency: 'emergency',
  move: 'moveIn',
};

const COLUMNS = 3;
const TILE_GAP = 10;

function nativeElevation(level: 1 | 2 | 3) {
  const { boxShadow: _webOnly, ...rest } = getCardElevation(level);
  return rest;
}

function chunkTiles(tiles: HubTile[], size: number): HubTile[][] {
  const rows: HubTile[][] = [];
  for (let i = 0; i < tiles.length; i += size) {
    rows.push(tiles.slice(i, i + size));
  }
  return rows;
}

export const MobileServiceCatalogBody: React.FC<MobileServiceCatalogBodyProps> = ({
  currentRole,
  onRequestService,
  onHubAction,
  activeTickets = [],
}) => {
  const { t } = useLocale();
  const { theme } = useMobileTheme();
  const openTickets = activeTickets.filter((ticket) => ticket.status !== 'completed' && ticket.status !== 'cancelled');

  const catalogTiles: HubTile[] = servicesMatrix
    .filter((service) => service.allowedRoles.includes(currentRole))
    .map((service) => ({
      key: service.category,
      title: t.services[SERVICE_LABEL_KEY[service.category]],
      icon: service.icon,
      badge:
        service.category === 'maintenance'
          ? openTickets.filter((ticket) => ticket.category === 'maintenance').length
          : 0,
      onPress: () => onRequestService?.(service.category),
    }));

  const extraTiles: HubTile[] = serviceHubExtraTiles
    .filter((tile) => tile.allowedRoles.includes(currentRole))
    .map((tile) => ({
      key: tile.id,
      title: t.services[EXTRA_LABEL_KEY[tile.id]],
      icon: tile.icon,
      highlight: tile.highlight,
      badge: tile.id === 'tickets' ? openTickets.length : 0,
      onPress: () => onHubAction?.(tile.id),
    }));

  const rows = chunkTiles([...catalogTiles, ...extraTiles], COLUMNS);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: theme.textHeading }]}>{t.services.title}</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{t.services.subtitle}</Text>
        </View>
        <View style={styles.hubPill}>
          <Text style={styles.hubPillText}>NESTYK</Text>
        </View>
      </View>

      <View style={styles.grid}>
        {rows.map((row, rowIndex) => (
          <View key={`row-${rowIndex}`} style={styles.gridRow}>
            {row.map((tile) => (
              <ServiceTile key={tile.key} tile={tile} />
            ))}
            {Array.from({ length: COLUMNS - row.length }).map((_, i) => (
              <View key={`spacer-${rowIndex}-${i}`} style={styles.tileSpacer} />
            ))}
          </View>
        ))}
      </View>

      {openTickets.length > 0 ? (
        <View style={styles.ticketsSection}>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
            {t.services.activeTickets}
          </Text>
          {openTickets.map((ticket) => {
            const statusLabel = t.services.status[ticket.status];
            const statusColor =
              ticket.status === 'in_progress'
                ? tokens.colors.warning
                : ticket.status === 'assigned'
                  ? tokens.colors.roles.services
                  : tokens.colors.accent;
            return (
              <Pressable
                key={ticket.id}
                onPress={() => onHubAction?.('tickets')}
                android_ripple={{ color: 'rgba(2,132,199,0.08)' }}
                style={({ pressed }) => [
                  styles.ticketCard,
                  nativeElevation(1),
                  { backgroundColor: theme.card },
                  pressed && styles.ticketPressed,
                ]}
              >
                <View style={styles.ticketIcon}>
                  <MobileIcon name={ticket.icon} size={20} color={tokens.colors.roles.services} />
                </View>
                <View style={styles.ticketText}>
                  <Text style={[styles.ticketTitle, { color: theme.textHeading }]}>{ticket.title}</Text>
                  <Text style={[styles.ticketTime, { color: theme.textSecondary }]}>{ticket.time}</Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: `${statusColor}22` }]}>
                  <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
};

const ServiceTile: React.FC<{ tile: HubTile }> = ({ tile }) => {
  const backgroundColor = tile.highlight ? tokens.colors.roles.tenant : tokens.colors.roles.services;

  return (
    <Pressable
      onPress={tile.onPress}
      android_ripple={{ color: 'rgba(255,255,255,0.28)' }}
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor },
        Platform.OS === 'ios' && pressed ? styles.tilePressed : null,
      ]}
    >
      {tile.badge && tile.badge > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{tile.badge}</Text>
        </View>
      ) : null}
      <MobileIcon name={tile.icon} size={28} tone="white" weight="regular" />
      <Text style={styles.tileLabel} numberOfLines={2}>
        {tile.title}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: { gap: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  headerText: { flex: 1 },
  title: { fontFamily: tokens.typography.native.headingTh, fontSize: 18, lineHeight: 27, fontWeight: '500' },
  subtitle: { fontFamily: tokens.typography.native.body, fontSize: 12, lineHeight: 18 },
  hubPill: { backgroundColor: tokens.colors.roles.services, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 },
  hubPillText: { fontFamily: tokens.typography.native.bodyBold, fontSize: 11, lineHeight: 16, color: '#FFFFFF', fontWeight: '700' },
  grid: { gap: TILE_GAP },
  gridRow: { flexDirection: 'row', gap: TILE_GAP },
  tile: { flex: 1, aspectRatio: 1, borderRadius: 18, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 6, overflow: 'hidden' },
  tilePressed: { opacity: 0.85 },
  tileSpacer: { flex: 1 },
  tileLabel: { fontFamily: tokens.typography.native.bodyBold, fontSize: 12, lineHeight: 18, fontWeight: '700', color: '#FFFFFF', textAlign: 'center' },
  badge: { position: 'absolute', top: 8, right: 8, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: tokens.colors.success, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, zIndex: 1 },
  badgeText: { fontFamily: tokens.typography.native.bodyBold, fontSize: 10, lineHeight: 14, color: '#FFFFFF', fontWeight: '700' },
  ticketsSection: { gap: 10, marginTop: 4 },
  sectionLabel: { fontFamily: tokens.typography.native.body, fontSize: 11, lineHeight: 16, fontWeight: '600', letterSpacing: 0.8 },
  ticketCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, padding: 12 },
  ticketPressed: { opacity: 0.9 },
  ticketIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  ticketText: { flex: 1 },
  ticketTitle: { fontFamily: tokens.typography.native.bodyBold, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  ticketTime: { fontFamily: tokens.typography.native.body, fontSize: 12, lineHeight: 18 },
  statusPill: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontFamily: tokens.typography.native.bodyBold, fontSize: 10, lineHeight: 15, fontWeight: '700' },
});
