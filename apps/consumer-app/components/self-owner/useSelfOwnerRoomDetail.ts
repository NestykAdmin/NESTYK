import { useEffect, useMemo, useState } from 'react';
import type { AgentRoomDetail } from '@nestyk/feature-listing';
import { selfOwnerRoomStore, type SelfOwnerRoom, type SelfOwnerRoomOptions } from '../../lib/self-owner-rooms';
import { roomDetailFromSelfOwner, selfOwnerListingDrafts } from '../../lib/self-owner-listing';

export type SelfOwnerRoomDetailState = {
  status: 'ready' | 'loading' | 'error';
  /** The agent detail page's data; null until the room's form data is here. */
  detail: AgentRoomDetail | null;
  /** Photos the room has (publishing needs 5). */
  photoCount: number;
};

/**
 * A room's detail for the self owner modal. On the demo it is built from the room (and what was saved in the form);
 * connected to the API it reads the room's form data every time the room opens or changes (kept in
 * `selfOwnerListingDrafts`, which edit reads too) and the API choices, so the detail names the real lease lengths
 * and room types. Edit and publish wait for that read, so a save never sends an older copy over a newer one.
 */
export function useSelfOwnerRoomDetail(room: SelfOwnerRoom | null): SelfOwnerRoomDetailState {
  const backend = selfOwnerRoomStore.backend();
  const [loaded, setLoaded] = useState<{ id: string; options: SelfOwnerRoomOptions } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const roomKey = room?.id ?? null;

  useEffect(() => {
    if (roomKey == null) {
      // Closed: the next open reads the room again.
      setLoaded(null);
      return;
    }
    if (!backend) return;
    let live = true;
    setFailed(null);
    // Always read the room again when it opens or changes: it may have been edited on another device.
    Promise.all([backend.detail(roomKey), backend.options()]).then(
      ([form, options]) => {
        if (!live) return;
        selfOwnerListingDrafts.set(roomKey, form);
        setLoaded({ id: roomKey, options });
      },
      () => {
        if (live) setFailed(roomKey);
      },
    );
    return () => {
      live = false;
    };
  }, [backend, roomKey, room?.updatedAt]);

  return useMemo((): SelfOwnerRoomDetailState => {
    if (!room) return { status: 'ready', detail: null, photoCount: 0 };
    const saved = selfOwnerListingDrafts.get(room.id);
    if (!backend) {
      const detail = roomDetailFromSelfOwner(room, saved);
      return { status: 'ready', detail, photoCount: detail.medias.length };
    }
    if (failed === room.id) return { status: 'error', detail: null, photoCount: 0 };
    if (loaded?.id !== room.id || !saved) return { status: 'loading', detail: null, photoCount: 0 };
    return { status: 'ready', detail: roomDetailFromSelfOwner(room, saved, loaded.options), photoCount: saved.medias.length };
  }, [room, backend, loaded, failed]);
}
