import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView, initialWindowMetrics } from 'react-native-safe-area-context';
import { MobileRoomDetailBody, interpolate } from '@nestyk/feature-listing';
import { MobileSectionHeader, tokens, useMobileTheme } from '@nestyk/ui/native';
import { useLocale } from '@nestyk/i18n';
import { canToggleListing, selfOwnerRoomErrorCode, selfOwnerRoomStore, toggleListing, useSelfOwnerRooms } from '../../lib/self-owner-rooms';
import { useSelfOwnerRoomDetail } from './useSelfOwnerRoomDetail';
import { SelfOwnerListingEditor } from './SelfOwnerListingEditor';
import type { SelfOwnerRoomDetailModalProps } from './SelfOwnerRoomDetailModal.types';

/**
 * Self owner room detail on the phone (Jom 20 Nov 2026), like the agent's AgentRoomDetailModal.tsx: full-screen,
 * header with back and edit, the agent room detail without sharing, publish / unpublish under the header.
 */
export function SelfOwnerRoomDetailModal({ roomId, onClose, ownerContact }: SelfOwnerRoomDetailModalProps) {
  const { t } = useLocale();
  const { theme } = useMobileTheme();
  const copy = t.agent.listings;
  const so = t.selfOwnerRooms;
  // The detail's internal card in the owner's words (no team, no share page; Jom 23 Nov 2026).
  const ownerInternalCopy = {
    hint: so.internalHint,
    titleLabel: so.titleField,
    visibilityLabel: so.internalVisibility,
    publishedLabel: t.selfOwnerDashboard.roomState.listed,
    privateLabel: t.selfOwnerDashboard.roomState.unlisted,
  };
  const { rooms } = useSelfOwnerRooms();
  const room = roomId ? rooms.find((item) => item.id === roomId) ?? null : null;
  const { status, detail, photoCount } = useSelfOwnerRoomDetail(room);

  const [editing, setEditing] = useState(false);
  const [editHeaderTitle, setEditHeaderTitle] = useState('');
  const editBackRef = useRef<(() => boolean) | null>(null);

  const stopEditing = useCallback(() => {
    setEditing(false);
    setEditHeaderTitle('');
  }, []);
  const handleBack = useCallback(() => {
    if (editing) {
      if (editBackRef.current?.()) return;
      stopEditing();
      return;
    }
    onClose();
  }, [editing, stopEditing, onClose]);

  const listed = room?.state === 'listed';
  const toggleLabel = listed ? so.unpublish : so.publish;
  const askToggle = () => {
    if (!room) return;
    Alert.alert(toggleLabel, interpolate(listed ? so.unpublishConfirm : so.publishConfirm, { title: room.title }), [
      { text: t.common.cancel, style: 'cancel' },
      { text: toggleLabel, onPress: () => {
        // Connected, the API decides; a room with fewer than 5 photos is told so without asking it.
        if (selfOwnerRoomStore.backend() && !listed && photoCount < 5) {
          Alert.alert(toggleLabel, so.publishNeedsPhotos);
          return;
        }
        void toggleListing(room.id).then((result) => {
          if (result.ok || !selfOwnerRoomStore.backend()) return;
          const code = selfOwnerRoomErrorCode(result.error);
          if (code === 'ROOM_RENTED') void selfOwnerRoomStore.refresh();
          Alert.alert(toggleLabel, code === 'ROOM_RENTED' ? so.occupiedNoToggle : code === 'PUBLISH_NEEDS_PHOTOS' ? so.publishNeedsPhotos : so.toggleFailed);
        });
      } },
    ]);
  };

  return (
    <Modal visible={roomId !== null} animationType="slide" onRequestClose={handleBack}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
          <View style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border }}>
            <MobileSectionHeader
              title={editing ? editHeaderTitle || copy.editRoom : copy.details}
              leading="back"
              onBackPress={handleBack}
              onActionPress={room && !editing && status === 'ready' ? () => setEditing(true) : undefined}
              actionLabel={room && !editing && status === 'ready' ? copy.edit : undefined}
              actionVariant="icon"
              actionIcon="note"
            />
            {room && !editing && status === 'ready' && canToggleListing(room) ? (
              <Pressable
                testID="sord-toggle"
                accessibilityRole="button"
                onPress={askToggle}
                style={{ alignSelf: 'flex-start', minHeight: 36, justifyContent: 'center', marginTop: 4, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: theme.border }}
              >
                <Text style={{ fontFamily: tokens.typography.native.body, fontSize: 13, lineHeight: 19, color: theme.screenTitle }}>{toggleLabel}</Text>
              </Pressable>
            ) : null}
          </View>
          {room && status === 'loading' ? (
            <View style={{ padding: 24 }}>
              <ActivityIndicator color={theme.spinner} accessibilityLabel={t.common.loading} />
            </View>
          ) : !room || !detail ? (
            <View style={{ padding: 24 }}>
              <Text style={{ color: theme.textHeading }}>{room && status === 'error' ? so.detailLoadError : so.noMatch}</Text>
            </View>
          ) : editing ? (
            <View style={{ flex: 1, padding: 16 }}>
              <SelfOwnerListingEditor
                room={room}
                backHandlerRef={editBackRef}
                ownerContact={ownerContact}
                onHeaderTitleChange={setEditHeaderTitle}
                onCancel={stopEditing}
                onDone={stopEditing}
              />
            </View>
          ) : (
            <MobileRoomDetailBody key={`${room.id}-${room.updatedAt}`} mode="agent" room={detail} ownerInternalCopy={ownerInternalCopy} mapsApiKey={process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY} />
          )}
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}
