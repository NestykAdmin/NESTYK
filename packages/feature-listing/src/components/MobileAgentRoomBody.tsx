import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { MobileRoomDetailBody } from './MobileRoomDetailBody';
import { RoomShareLinkSheet, type RoomShareLinkApi } from './RoomShareLinkSheet';
import type { AgentRoomDetail } from '../agent-room-detail';
import {
  computeShareCompleteness,
  DEFAULT_ROOM_SHARE_VISIBILITY,
  type RoomShareVisibility,
} from '../share-completeness';

export type { AgentRoomDetail } from '../agent-room-detail';

/**
 * Agent room detail — shared layout + share sheet + customer preview.
 */
export function MobileAgentRoomBody({
  room,
  mapsApiKey,
  onEdit,
  shareLinkApi,
  previewing: previewingProp,
  onPreviewChange,
  hidePreviewBanner = false,
  initialPreview,
}: {
  room: AgentRoomDetail;
  mapsApiKey?: string;
  onEdit?: () => void;
  shareLinkApi: RoomShareLinkApi;
  /** Controlled preview mode (optional). */
  previewing?: boolean;
  onPreviewChange?: (previewing: boolean) => void;
  /** When true, parent renders the preview chrome (e.g. replaces modal header). */
  hidePreviewBanner?: boolean;
  /** Sections and contact for a preview requested before this body mounted (e.g. from another screen's share sheet). */
  initialPreview?: { visibility: RoomShareVisibility; contactId: number | null };
}) {
  const [shareOpen, setShareOpen] = useState(false);
  const [previewingInternal, setPreviewingInternal] = useState(false);
  const previewing = previewingProp ?? previewingInternal;
  const setPreviewing = (next: boolean) => {
    if (previewingProp === undefined) setPreviewingInternal(next);
    onPreviewChange?.(next);
  };
  const [previewVisibility, setPreviewVisibility] = useState<RoomShareVisibility>(
    initialPreview?.visibility ?? DEFAULT_ROOM_SHARE_VISIBILITY,
  );
  const [previewContactId, setPreviewContactId] = useState<number | null>(initialPreview?.contactId ?? null);

  useEffect(() => {
    if (previewingProp === false) setPreviewingInternal(false);
  }, [previewingProp]);

  const shareComplete = useMemo(() => {
    const result = computeShareCompleteness(room);
    return { done: result.done, total: result.total };
  }, [room]);

  if (previewing) {
    return (
      <View style={styles.fill}>
        <MobileRoomDetailBody
          mode="preview"
          room={room}
          mapsApiKey={mapsApiKey}
          shareVisibility={previewVisibility}
          shareContactId={previewContactId}
          hidePreviewBanner={hidePreviewBanner}
          onClosePreview={() => setPreviewing(false)}
        />
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <MobileRoomDetailBody
        mode="agent"
        room={room}
        mapsApiKey={mapsApiKey}
        shareComplete={shareComplete}
        onShare={() => setShareOpen(true)}
        onOpenShareCheck={onEdit}
      />
      <RoomShareLinkSheet
        visible={shareOpen}
        room={room}
        api={shareLinkApi}
        onClose={() => setShareOpen(false)}
        onPreview={(visibility, contactId) => {
          setPreviewVisibility(visibility);
          setPreviewContactId(contactId);
          setShareOpen(false);
          setPreviewing(true);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
