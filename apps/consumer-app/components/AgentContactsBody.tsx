import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { SlideInRight } from 'react-native-reanimated';
import { useLocale } from '@nestyk/i18n';
import {
  MobileBrandLoader,
  MobileButton,
  MobileIcon,
  MobileListSearchRow,
  ModePageScrollContext,
  tokens,
  useMobileTheme,
} from '@nestyk/ui/native';
import type { AgentContactDetail, AgentOwnerContact } from '../lib/agent-listings-api';
import { CONTACT_PAGE_SIZE, listDirectoryContacts, type AgentDirectoryKind } from '../lib/agent-contacts-api';
import { AgentContactDetailBody, type ContactDetailActions, type ContactDetailState } from './AgentContactDetailBody';

/** The page shell owns the header, scrolling, refresh gesture and bottom tabs. */
export function AgentContactsBody({
  kind,
  reloadToken,
  onReloadSettled,
  onContactSaved,
  onDetailStateChange,
  detailActionsRef,
}: {
  kind: AgentDirectoryKind;
  reloadToken: number;
  onReloadSettled: (token: number) => void;
  onContactSaved: () => void;
  onDetailStateChange: (state: ContactDetailState | null) => void;
  detailActionsRef: React.MutableRefObject<ContactDetailActions | null>;
}) {
  const { t } = useLocale();
  const { theme, isDark } = useMobileTheme();
  const copy = t.agent.dashboard;
  const prefix = ({ owner: 'ownerContacts', landlord: 'landlordContacts', lead: 'leadContacts', tenant: 'tenantContacts', coAgent: 'coAgentContacts' } as const)[kind];
  const labels = {
    hint: copy[`${prefix}Hint`], search: copy[`${prefix}Search`],
    count: copy[`${prefix}Count`], empty: copy[`${prefix}Empty`],
    noResults: copy[`${prefix}NoResults`], error: copy[`${prefix}LoadError`],
    rooms: copy[`${prefix}Rooms`],
  };
  const icon = kind === 'coAgent' ? 'handshake' : kind === 'landlord' ? 'buildings' : kind === 'lead' ? 'user-plus' : kind === 'tenant' ? 'user' : 'key';
  const color = kind === 'coAgent' ? tokens.colors.roles.agent : kind === 'lead' ? tokens.colors.brand[700] : kind === 'tenant' ? '#00966C' : tokens.colors.roles.owner;
  const [items, setItems] = useState<AgentOwnerContact[]>([]);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const selectedIdRef = useRef<number | null>(selectedId);
  selectedIdRef.current = creating ? 0 : selectedId;
  const pageScroll = useContext(ModePageScrollContext);
  const restoreId = useRef<number | null>(null);
  const selectedRowRef = useRef<View | null>(null);

  useEffect(() => {
    if (creating || selectedId !== null || restoreId.current === null) return;
    if (selectedRowRef.current) pageScroll?.scrollToView(selectedRowRef, { animated: false });
    else pageScroll?.scrollTo({ y: 0, animated: false });
    restoreId.current = null;
  }, [creating, selectedId, pageScroll]);

  const closeDetail = useCallback(() => {
    onReloadSettled(reloadToken);
    setSelectedId(null);
    setCreating(false);
    onDetailStateChange(null);
  }, [onDetailStateChange, onReloadSettled, reloadToken]);

  const saved = useCallback((contact: AgentContactDetail) => {
    setFailed(false);
    setItems((current) => current.map((item) => item.id === contact.id ? { ...item, name: contact.name, phone: contact.phone } : item));
    setRetry((n) => n + 1);
    if (creating) {
      setQuery('');
      setPage(1);
      setSelectedId(contact.id);
      setCreating(false);
    }
    onContactSaved();
  }, [creating, onContactSaved]);

  useEffect(() => {
    let active = true;
    let correctingPage = false;
    setLoading(true);
    setFailed(false);
    const timer = setTimeout(() => {
      listDirectoryContacts(kind, query, page)
        .then((result) => {
          if (!active) return;
          const lastPage = Math.max(1, Math.ceil(result.total / CONTACT_PAGE_SIZE));
          if (page > lastPage) {
            correctingPage = true;
            setPage(lastPage);
            return;
          }
          setItems(result.items);
          setTotal(result.total);
        })
        .catch(() => { if (active) setFailed(true); })
        .finally(() => {
          if (!active || correctingPage) return;
          setLoading(false);
          // While a detail is open, its own request owns refresh completion.
          if (selectedIdRef.current === null) onReloadSettled(reloadToken);
        });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [kind, query, page, reloadToken, retry, onReloadSettled]);

  const search = useCallback((value: string) => {
    if (value === query && page === 1) return;
    setLoading(true);
    setQuery(value);
    setPage(1);
  }, [query, page]);

  const changePage = (next: number) => {
    setLoading(true);
    setPage(next);
    pageScroll?.scrollTo({ y: 0, animated: false });
  };

  if (creating || selectedId !== null) return (
    <AgentContactDetailBody
      key={`${kind}-${creating ? 'new' : selectedId}`}
      kind={kind}
      contactId={creating ? null : selectedId}
      onClose={closeDetail}
      onSaved={saved}
      onStateChange={onDetailStateChange}
      actionsRef={detailActionsRef}
      reloadToken={reloadToken}
      onReloadSettled={onReloadSettled}
    />
  );

  return (
    <Animated.View entering={SlideInRight.duration(200)} style={styles.body}>
      <Text style={[styles.hint, { color: theme.textSecondary }]}>{labels.hint}</Text>
      {kind === 'coAgent' && (
        <MobileButton disabled={loading} onPress={() => {
          setCreating(true);
          pageScroll?.scrollTo({ y: 0, animated: false });
        }}>{copy.coAgentContactsAdd}</MobileButton>
      )}
      <MobileListSearchRow
        value={query}
        onChangeText={search}
        placeholder={labels.search}
        onClear={() => search('')}
        clearAccessibilityLabel={t.agent.tenants.clearSearch}
      />
      {loading ? <MobileBrandLoader /> : failed ? (
        <View style={styles.message}>
          <Text style={[styles.hint, { color: theme.textSecondary }]} accessibilityRole="alert">
            {labels.error}
          </Text>
          <MobileButton onPress={() => setRetry((n) => n + 1)}>{t.agent.listings.retry}</MobileButton>
        </View>
      ) : (
        <>
          <Text style={[styles.count, { color: theme.textSecondary }]}>
            {labels.count.replace('{count}', String(total))}
          </Text>
          {items.length === 0 ? (
            <View style={styles.message}>
              <MobileIcon name={icon} size={32} color={theme.textSecondary} />
              <Text style={[styles.hint, { color: theme.textSecondary }]}>
                {query.trim() ? labels.noResults : labels.empty}
              </Text>
            </View>
          ) : items.map((owner) => (
            <Pressable
              key={owner.id}
              ref={(node) => { if (owner.id === restoreId.current) selectedRowRef.current = node; }}
              onPress={() => {
                restoreId.current = owner.id;
                setSelectedId(owner.id);
                pageScroll?.scrollTo({ y: 0, animated: false });
              }}
              accessibilityRole="button"
              accessibilityLabel={owner.name}
              android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
              style={({ pressed }) => [styles.card, {
                backgroundColor: theme.surface, borderColor: theme.border,
                opacity: pressed && Platform.OS === 'ios' ? 0.7 : 1,
              }]}
            >
              <View style={[styles.icon, { backgroundColor: kind === 'coAgent' ? (isDark ? 'rgba(255,0,82,0.18)' : '#FFE5EE') : (isDark ? 'rgba(0,85,218,0.18)' : '#E8F0FE') }]}>
                <MobileIcon name={icon} size={22} color={color} />
              </View>
              <View style={styles.copy}>
                <Text style={[styles.name, { color: theme.textHeading }]}>{owner.name}</Text>
                <Text style={[styles.phone, { color: theme.textSecondary }]}>{owner.phone}</Text>
                <Text style={[styles.phone, { color: theme.textSecondary }]}>
                  {labels.rooms.replace('{count}', String(owner.roomCount))}
                </Text>
              </View>
              <MobileIcon name="chevron-right" size={18} color={theme.textSecondary} />
            </Pressable>
          ))}
          {total > CONTACT_PAGE_SIZE && (
            <View style={styles.pagination}>
              <MobileButton variant="outline" disabled={page === 1} onPress={() => changePage(page - 1)}>{t.agent.leads.previous}</MobileButton>
              <Text style={[styles.page, { color: theme.textHeading }]}>{page} / {Math.ceil(total / CONTACT_PAGE_SIZE)}</Text>
              <MobileButton variant="outline" disabled={page * CONTACT_PAGE_SIZE >= total} onPress={() => changePage(page + 1)}>{t.agent.leads.next}</MobileButton>
            </View>
          )}
        </>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  body: { gap: 12 },
  hint: { fontFamily: tokens.typography.native.body, fontSize: 14, lineHeight: 21 },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingVertical: 12 },
  page: { fontFamily: tokens.typography.native.body, fontSize: 14, lineHeight: 21 },
  count: { fontFamily: tokens.typography.native.body, fontSize: 12, lineHeight: 18 },
  message: { alignItems: 'center', gap: 16, paddingVertical: 32 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: 14 },
  icon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontFamily: tokens.typography.native.bodyBold, fontSize: 15, lineHeight: 23 },
  phone: { fontFamily: tokens.typography.native.body, fontSize: 13, lineHeight: 20 },
});
