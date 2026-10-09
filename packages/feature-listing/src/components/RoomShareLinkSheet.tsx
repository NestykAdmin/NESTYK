import type { AgentRoomDetail } from '../agent-room-detail';
import {
  DEFAULT_ROOM_SHARE_VISIBILITY,
  type RoomShareVisibility,
} from '../share-completeness';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { localizedError, useLocale } from '@nestyk/i18n';
import {
  MobileBottomSheet,
  MobileButton,
  MobileIcon,
  SelectionCheck,
  tokens,
} from '@nestyk/ui/native';

export type RoomShareLinkApi = {
  create: (
    roomId: number,
    body: {
      expiresInDays?: number;
      shareSections?: RoomShareVisibility;
      contactId?: number | null;
    },
  ) => Promise<{
    id: number;
    url: string;
    expiresAt: string;
    status: string;
  }>;
  list: (roomId: number) => Promise<{
    items: Array<{
      id: number;
      expiresAt: string;
      revokedAt: string | null;
      status: 'active' | 'expired' | 'revoked';
      shareSections: RoomShareVisibility;
      contactId: number | null;
    }>;
  }>;
  revoke: (roomId: number, linkId: number) => Promise<unknown>;
};

function interpolate(template: string, vars: Record<string, string | number>) {
  return Object.entries(vars).reduce(
    (out, [key, value]) => out.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value)),
    template,
  );
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through
  }
  try {
    // Browsers without secure clipboard: selectable textarea fallback
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const el = document.createElement('textarea');
      el.value = text;
      el.setAttribute('readonly', '');
      el.style.position = 'fixed';
      el.style.left = '-9999px';
      document.body.appendChild(el);
      el.focus();
      el.select();
      el.setSelectionRange(0, text.length);
      const ok = document.execCommand('copy');
      document.body.removeChild(el);
      if (ok) return true;
    }
  } catch {
    // fall through
  }
  return false;
}

export type RoomShareLinkSheetProps = {
  visible: boolean;
  room: AgentRoomDetail;
  api: RoomShareLinkApi;
  onClose: () => void;
  onPreview: (visibility: RoomShareVisibility, contactId: number | null) => void;
};

type ToggleKey = Exclude<keyof RoomShareVisibility, 'contact'>;
const TOGGLE_KEYS: ToggleKey[] = ['photos', 'price', 'facilities', 'location'];
const EXPIRY_PRESETS = [7, 14, 30] as const;

export function RoomShareLinkSheet({
  visible,
  room,
  api,
  onClose,
  onPreview,
}: RoomShareLinkSheetProps) {
  const { t, locale } = useLocale();
  const rd = t.agent.roomDetail;
  const [visibility, setVisibility] = useState<RoomShareVisibility>(DEFAULT_ROOM_SHARE_VISIBILITY);
  const [expiresInDays, setExpiresInDays] = useState<number>(7);
  const [busy, setBusy] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [createdExpiresAt, setCreatedExpiresAt] = useState<string | null>(null);
  const [links, setLinks] = useState<
    Array<{
      id: number;
      expiresAt: string;
      status: 'active' | 'expired' | 'revoked';
    }>
  >([]);

  const formatDate = useCallback(
    (iso: string) => {
      try {
        return new Date(iso).toLocaleString(locale === 'th' ? 'th-TH' : locale, {
          dateStyle: 'medium',
          timeStyle: 'short',
        });
      } catch {
        return iso;
      }
    },
    [locale],
  );

  const refreshList = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await api.list(room.id);
      setLinks(
        res.items.map((item) => ({
          id: item.id,
          expiresAt: item.expiresAt,
          status: item.status,
        })),
      );
    } catch {
      setLinks([]);
    } finally {
      setLoadingList(false);
    }
  }, [api, room.id]);

  useEffect(() => {
    if (!visible) return;
    setVisibility(DEFAULT_ROOM_SHARE_VISIBILITY);
    setExpiresInDays(7);
    setCreatedUrl(null);
    setCreatedExpiresAt(null);
    void refreshList();
  }, [visible, room.id, refreshList]);

  const visibleCount = TOGGLE_KEYS.filter((key) => visibility[key]).length;

  const toggleKeyLabel = (key: ToggleKey) => {
    if (key === 'photos') return rd.shareTogglePhotos;
    if (key === 'price') return rd.shareTogglePrice;
    if (key === 'facilities') return rd.shareToggleFacilities;
    return rd.shareToggleLocation;
  };

  const shareSectionsForLink = (): RoomShareVisibility => ({
    ...visibility,
    contact: false,
  });

  const onCreate = async () => {
    setBusy(true);
    try {
      const shareSections = shareSectionsForLink();
      const created = await api.create(room.id, {
        expiresInDays,
        shareSections,
        contactId: null,
      });
      setCreatedUrl(created.url);
      setCreatedExpiresAt(created.expiresAt);
      // Device Hub: system clipboard is sandboxed — also log for terminal/Metro copy.
      console.log(`[room-share-link] url=${created.url} expiresAt=${created.expiresAt}`);
      await refreshList();
      const copied = await copyTextToClipboard(created.url);
      if (copied) {
        Alert.alert(rd.shareManageTitle, rd.shareLinkCopied);
      }
    } catch (e) {
      Alert.alert(rd.shareManageTitle, localizedError(e, rd.shareLinkCopyFailed, locale));
    } finally {
      setBusy(false);
    }
  };

  const onShareUrl = async (url: string) => {
    try {
      const copied = await copyTextToClipboard(url);
      if (copied) {
        Alert.alert(rd.shareManageTitle, rd.shareLinkCopied);
        return;
      }
      const result = await Share.share({
        message: url,
        url: Platform.OS === 'ios' ? url : undefined,
      });
      if (Platform.OS === 'web' || result?.action === Share.sharedAction) {
        Alert.alert(rd.shareManageTitle, rd.shareLinkCopied);
      }
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return;
      Alert.alert(rd.shareLinkCopyFailed);
    }
  };

  const onRevoke = (linkId: number) => {
    Alert.alert(rd.shareDisableLink, rd.shareRevokeConfirm, [
      { text: rd.shareCancel, style: 'cancel' },
      {
        text: rd.shareDisableLink,
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setBusy(true);
            try {
              await api.revoke(room.id, linkId);
              if (createdUrl) setCreatedUrl(null);
              await refreshList();
            } catch (e) {
              Alert.alert(
                rd.shareManageTitle,
                localizedError(e, rd.shareLinkCopyFailed, locale),
              );
            } finally {
              setBusy(false);
            }
          })();
        },
      },
    ]);
  };

  const statusLabel = (status: 'active' | 'expired' | 'revoked') => {
    if (status === 'active') return rd.shareLinkActive;
    if (status === 'expired') return rd.shareLinkExpired;
    return rd.shareLinkInactive;
  };

  return (
    <MobileBottomSheet visible={visible} onClose={onClose} maxHeight="92%">
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{rd.shareManageTitle}</Text>

        <Text style={styles.sectionLabel}>{rd.shareExpiryTitle}</Text>
        <View style={styles.expiryRow}>
          {EXPIRY_PRESETS.map((days) => {
            const on = expiresInDays === days;
            return (
              <Pressable
                key={days}
                onPress={() => setExpiresInDays(days)}
                style={[styles.expiryChip, on ? styles.expiryChipOn : null]}
              >
                <Text style={[styles.expiryChipText, on ? styles.expiryChipTextOn : null]}>
                  {interpolate(rd.shareExpiryDays, { days })}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>
          {interpolate(rd.shareCustomerSees, {
            done: visibleCount,
            total: TOGGLE_KEYS.length,
          })}
        </Text>
        <View style={styles.toggleCard}>
          {TOGGLE_KEYS.map((key) => {
            const on = visibility[key];
            return (
              <Pressable
                key={key}
                style={styles.toggleRow}
                onPress={() => setVisibility((prev) => ({ ...prev, [key]: !prev[key] }))}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
              >
                <SelectionCheck selected={on} variant="row" size="md" />
                <Text style={styles.toggleLabel}>{toggleKeyLabel(key)}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.lockedCard}>
          <Text style={styles.sectionLabel}>{rd.shareNotSharedTitle}</Text>
          {[
            rd.shareListingContact,
            interpolate(rd.listingId, { id: '' }).replace(/[:：]\s*$/, '').trim() || rd.listingId,
            rd.shareNotSharedInternalName,
            rd.shareNotSharedProvider,
            rd.shareNotSharedNotes,
          ].map((label) => (
              <View key={label} style={styles.lockedRow}>
                <MobileIcon name="lock" size={14} color={tokens.colors.icon.secondary} />
                <Text style={styles.lockedText}>{label}</Text>
              </View>
            ),
          )}
        </View>

        {createdUrl ? (
          <View style={styles.linkCard}>
            <Text style={styles.statusText}>{rd.shareLinkActive}</Text>
            {createdExpiresAt ? (
              <Text style={styles.updatedText}>
                {interpolate(rd.shareLinkExpiresAt, { date: formatDate(createdExpiresAt) })}
              </Text>
            ) : null}
            <Text style={styles.urlText} selectable>
              {createdUrl}
            </Text>
            <MobileButton variant="outline" onPress={() => void onShareUrl(createdUrl)}>
              {rd.shareCopyLink}
            </MobileButton>
          </View>
        ) : null}

        <MobileButton onPress={() => void onCreate()} disabled={busy} style={styles.previewCta}>
          {busy ? '…' : rd.shareCreateLink}
        </MobileButton>
        <MobileButton
          variant="outline"
          onPress={() => {
            onPreview(shareSectionsForLink(), null);
            onClose();
          }}
        >
          {rd.sharePreviewCta}
        </MobileButton>

        <Text style={[styles.sectionLabel, { marginTop: 8 }]}>{rd.shareLinksListTitle}</Text>
        {loadingList ? (
          <ActivityIndicator color={tokens.colors.brand[500]} />
        ) : links.length === 0 ? (
          <Text style={styles.emptyContact}>{rd.shareLinksEmpty}</Text>
        ) : (
          links.map((link) => (
            <View key={link.id} style={styles.linkMetaRow}>
              <View style={styles.contactPickCopy}>
                <Text style={styles.contactName}>{statusLabel(link.status)}</Text>
                <Text style={styles.contactMeta}>
                  {interpolate(rd.shareLinkExpiresAt, { date: formatDate(link.expiresAt) })}
                </Text>
              </View>
              {link.status === 'active' ? (
                <Pressable onPress={() => onRevoke(link.id)} hitSlop={8}>
                  <Text style={styles.revokeText}>{rd.shareDisableLink}</Text>
                </Pressable>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>
    </MobileBottomSheet>
  );
}

const styles = StyleSheet.create({
  scroll: { maxHeight: 640 },
  content: { paddingHorizontal: 16, paddingBottom: 28, gap: 12 },
  title: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 20,
    lineHeight: 28,
    color: tokens.colors.textHeading,
    marginBottom: 4,
  },
  linkCard: {
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 14,
    padding: 14,
    gap: 8,
    backgroundColor: '#FFFFFF',
  },
  statusText: {
    fontFamily: tokens.typography.native.bodyBold,
    fontSize: 14,
    lineHeight: 21,
    color: tokens.colors.textHeading,
  },
  updatedText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    color: tokens.colors.textSecondary,
  },
  urlText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    color: tokens.colors.textHeading,
  },
  sectionLabel: {
    fontFamily: tokens.typography.native.bodyBold,
    fontSize: 14,
    lineHeight: 21,
    color: tokens.colors.textHeading,
    marginTop: 4,
  },
  expiryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  expiryChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: '#FFFFFF',
  },
  expiryChipOn: {
    borderColor: tokens.colors.brand[500],
    backgroundColor: '#FFFBEB',
  },
  expiryChipText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    color: tokens.colors.textSecondary,
  },
  expiryChipTextOn: {
    color: tokens.colors.primary,
    fontWeight: '700',
  },
  toggleCard: {
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.colors.border,
  },
  toggleLabel: {
    flex: 1,
    fontFamily: tokens.typography.native.body,
    fontSize: 15,
    lineHeight: 22,
    color: tokens.colors.textHeading,
  },
  contactPick: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  contactPickCopy: { flex: 1, gap: 2 },
  contactName: {
    fontFamily: tokens.typography.native.bodyBold,
    fontSize: 15,
    lineHeight: 22,
    color: tokens.colors.textHeading,
  },
  contactMeta: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    color: tokens.colors.textSecondary,
  },
  contactList: {
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  contactOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.colors.border,
  },
  contactOptionOn: { backgroundColor: '#FFFBEB' },
  emptyContact: {
    padding: 14,
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
    color: tokens.colors.textSecondary,
  },
  lockedCard: {
    borderRadius: 14,
    padding: 14,
    gap: 8,
    backgroundColor: '#F8FAFC',
  },
  lockedRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lockedText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    color: tokens.colors.textSecondary,
  },
  previewCta: { marginTop: 4 },
  linkMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  revokeText: {
    fontFamily: tokens.typography.native.bodyBold,
    fontSize: 13,
    lineHeight: 20,
    color: tokens.colors.error,
  },
});
