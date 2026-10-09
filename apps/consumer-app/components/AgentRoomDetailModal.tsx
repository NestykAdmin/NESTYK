import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaView, SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { MobileAgentRoomBody, type AgentRoomDetail, type RoomShareVisibility } from '@nestyk/feature-listing';
import { MobileButton, MobileIcon, MobileSectionHeader, tokens, useMobileTheme } from '@nestyk/ui/native';
import { localizedError, useLocale } from '@nestyk/i18n';
import { AgentRoomEditor } from './AgentRoomEditor';
import {
  fetchAgentRoom,
  createRoomShareLink,
  listRoomShareLinks,
  revokeRoomShareLink,
} from '../lib/agent-listings-api';

export type RoomSharePreview = { visibility: RoomShareVisibility; contactId: number | null };

/** Full-screen room detail (view, edit, share preview) over whatever screen opened it. */
export function AgentRoomDetailModal({
  roomId,
  preview = null,
  onClose,
  onSaved,
}: {
  roomId: number | null;
  /** Open straight into the customer preview; closing the preview closes the modal. */
  preview?: RoomSharePreview | null;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const { t, locale } = useLocale();
  const { theme } = useMobileTheme();
  const copy = t.agent.listings;

  const [modalReady, setModalReady] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sharePreviewing, setSharePreviewing] = useState(false);
  const [room, setRoom] = useState<AgentRoomDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailRefresh, setDetailRefresh] = useState(0);
  const promoStaleByRoomRef = useRef<Record<number, boolean>>({});
  const editRoomBackRef = useRef<(() => boolean) | null>(null);
  const [editHeaderTitle, setEditHeaderTitle] = useState('');

  const handleBack = useCallback(() => {
    if (saving) return;
    if (sharePreviewing && !preview) {
      setSharePreviewing(false);
      return;
    }
    if (editing) {
      if (editRoomBackRef.current?.()) return;
      setEditing(false);
      setEditHeaderTitle('');
      return;
    }
    onClose();
  }, [saving, editing, sharePreviewing, preview, onClose]);

  useEffect(() => {
    if (roomId !== null) {
      setSharePreviewing(preview !== null);
      return;
    }
    setModalReady(false);
    setSharePreviewing(false);
  }, [roomId, preview]);

  useEffect(() => {
    if (!editing) setEditHeaderTitle('');
  }, [editing]);

  useEffect(() => {
    if (roomId === null) return;
    let cancelled = false;
    setRoom(null);
    setDetailError(null);
    fetchAgentRoom(roomId)
      .then((result) => {
        if (!cancelled) {
          setRoom({
            ...result,
            promoCopyStale: promoStaleByRoomRef.current[result.id],
          });
        }
      })
      .catch((err) => {
        if (!cancelled) setDetailError(localizedError(err, copy.loadError, locale));
      });
    return () => {
      cancelled = true;
    };
  }, [roomId, detailRefresh]);

  return (
    <Modal
      onShow={() => setModalReady(true)}
      visible={roomId !== null}
      presentationStyle="fullScreen"
      animationType="slide"
      onRequestClose={() => {
        if (!saving) handleBack();
      }}
    >
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
          <View
            style={{
              paddingHorizontal: sharePreviewing ? 0 : 16,
              paddingTop: sharePreviewing ? 0 : 4,
              paddingBottom: sharePreviewing ? 0 : 8,
              flexShrink: 0,
              zIndex: 1,
              backgroundColor: sharePreviewing ? '#0F172A' : theme.surface,
              borderBottomWidth: sharePreviewing ? 0 : 1,
              borderBottomColor: theme.border,
            }}
          >
            {sharePreviewing ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  minHeight: 56,
                  paddingHorizontal: 16,
                  paddingTop: 4,
                  paddingBottom: 8,
                }}
              >
                <MobileIcon name="globe" size={16} color="#FFFFFF" />
                <Text
                  style={{
                    flex: 1,
                    fontFamily: tokens.typography.native.body,
                    fontSize: 15,
                    lineHeight: 22,
                    color: '#FFFFFF',
                    fontWeight: '600',
                  }}
                >
                  {t.agent.roomDetail.previewBanner}
                </Text>
                <Pressable onPress={handleBack} hitSlop={8}>
                  <Text
                    style={{
                      fontFamily: tokens.typography.native.body,
                      fontSize: 14,
                      lineHeight: 21,
                      color: tokens.colors.brand[500],
                      fontWeight: '700',
                    }}
                  >
                    {t.agent.roomDetail.closePreview}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <MobileSectionHeader
                title={editing ? editHeaderTitle || copy.editRoom : copy.details}
                leading="back"
                backDisabled={saving}
                onBackPress={handleBack}
                onActionPress={room && !editing ? () => setEditing(true) : undefined}
                actionLabel={room && !editing ? copy.edit : undefined}
                actionVariant="icon"
                actionIcon="note"
              />
            )}
          </View>
          {!modalReady ? (
            <ActivityIndicator />
          ) : detailError ? (
            <View style={{ padding: 24, gap: 16 }}>
              <Text style={{ color: theme.textHeading }}>{detailError}</Text>
              <MobileButton onPress={() => setDetailRefresh((n) => n + 1)}>{copy.retry}</MobileButton>
            </View>
          ) : room ? (
            editing ? (
              <View style={{ flex: 1, padding: 16 }}>
                <AgentRoomEditor
                  room={room}
                  backHandlerRef={editRoomBackRef}
                  onHeaderTitleChange={setEditHeaderTitle}
                  onBusy={setSaving}
                  onCancelEdit={() => {
                    setEditing(false);
                    setEditHeaderTitle('');
                  }}
                  onSaved={(result) => {
                    setEditing(false);
                    setEditHeaderTitle('');
                    if (result?.promoCopyStale != null && room) {
                      promoStaleByRoomRef.current[room.id] = Boolean(result.promoCopyStale);
                    }
                    setDetailRefresh((n) => n + 1);
                    onSaved?.();
                  }}
                />
              </View>
            ) : (
              <MobileAgentRoomBody
                mapsApiKey={process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY}
                key={`${room.id}-${detailRefresh}`}
                room={room}
                onEdit={() => setEditing(true)}
                previewing={sharePreviewing}
                onPreviewChange={setSharePreviewing}
                hidePreviewBanner
                initialPreview={preview ?? undefined}
                shareLinkApi={{
                  create: createRoomShareLink,
                  list: listRoomShareLinks,
                  revoke: revokeRoomShareLink,
                }}
              />
            )
          ) : (
            <ActivityIndicator />
          )}
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}
