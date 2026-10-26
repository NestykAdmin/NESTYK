import React, { useCallback, useEffect, useRef, useState } from "react";
import { Modal } from "react-native";
import Constants from "expo-constants";
import { WebContentContainer } from "@nestyk/ui/web-content";
import "./agent-web/agent-room-detail.css";
import {
  MobileAgentRoomBody,
  type AgentRoomDetail,
  type RoomShareVisibility,
} from "@nestyk/feature-listing";
import { MobileIcon, useMobileTheme } from "@nestyk/ui/native";
import { localizedError, useLocale } from "@nestyk/i18n";
import { AgentRoomEditor } from "./AgentRoomEditor";
import {
  fetchAgentRoom,
  createRoomShareLink,
  listRoomShareLinks,
  revokeRoomShareLink,
} from "../lib/agent-listings-api";

export type RoomSharePreview = {
  visibility: RoomShareVisibility;
  contactId: number | null;
};

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

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sharePreviewing, setSharePreviewing] = useState(false);
  const [room, setRoom] = useState<AgentRoomDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailRefresh, setDetailRefresh] = useState(0);
  const promoStaleByRoomRef = useRef<Record<number, boolean>>({});
  const editRoomBackRef = useRef<(() => boolean) | null>(null);
  const [editHeaderTitle, setEditHeaderTitle] = useState("");

  const handleBack = useCallback(() => {
    if (saving) return;
    if (sharePreviewing && !preview) {
      setSharePreviewing(false);
      return;
    }
    if (editing) {
      if (editRoomBackRef.current?.()) return;
      setEditing(false);
      setEditHeaderTitle("");
      return;
    }
    onClose();
  }, [saving, editing, sharePreviewing, preview, onClose]);

  useEffect(() => {
    if (roomId !== null) {
      setSharePreviewing(preview !== null);
      return;
    }
    setSharePreviewing(false);
  }, [roomId, preview]);

  useEffect(() => {
    if (!editing) setEditHeaderTitle("");
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
        if (!cancelled)
          setDetailError(localizedError(err, copy.loadError, locale));
      });
    return () => {
      cancelled = true;
    };
  }, [roomId, detailRefresh]);

  // React Native Web owns the overlay stack so its share sheet can open above this page.
  const photoEscape = useRef(false);
  return (
    <Modal
      visible={roomId !== null}
      transparent
      animationType="none"
      onRequestClose={handleBack}
      accessibilityLabel={
        sharePreviewing
          ? t.agent.roomDetail.previewBanner
          : editing
            ? editHeaderTitle || copy.editRoom
            : copy.details
      }
    >
      <div className="ard-modal-backdrop">
        <section
          className="aw-shell ard-dialog"
          data-theme={theme.mode}
          onKeyDownCapture={(event) => {
            if (
              event.key === "Escape" &&
              event.currentTarget.contains(event.target as Node)
            ) {
              photoEscape.current = Boolean(
                event.currentTarget.querySelector(".ard-lightbox[open]"),
              );
            }
          }}
          onKeyUpCapture={(event) => {
            // Portal events bubble through React ancestors; the share sheet handles its own Escape.
            if (
              event.key !== "Escape" ||
              !event.currentTarget.contains(event.target as Node)
            )
              return;
            event.stopPropagation();
            if (!photoEscape.current) handleBack();
            photoEscape.current = false;
          }}
          style={
            {
              "--aw-bg": theme.background,
              "--aw-surface": theme.surface,
              "--aw-ink": theme.screenTitle,
              "--aw-muted": theme.textSecondary,
              "--aw-border": theme.border,
            } as React.CSSProperties
          }
        >
          {roomId !== null && (
            <>
              <header
                className={`ard-header ${sharePreviewing ? "ard-preview-header" : ""}`}
              >
                <WebContentContainer>
                  <div className="ard-header-inner">
                    <button
                      className="aw-icon-button"
                      onClick={handleBack}
                      disabled={saving}
                      aria-label={t.agent.createRoom.back}
                    >
                      <MobileIcon
                        name="chevron-left"
                        size={20}
                        color="currentColor"
                      />
                    </button>
                    <div className="ard-header-title">
                      <h1>
                        {sharePreviewing
                          ? t.agent.roomDetail.previewBanner
                          : editing
                            ? editHeaderTitle || copy.editRoom
                            : copy.details}
                      </h1>
                      {!editing && !sharePreviewing && room?.id === roomId && (
                        <span>NK-{room.id}</span>
                      )}
                    </div>
                    <div className="ard-header-actions">
                      {room?.id === roomId && !editing && !sharePreviewing && (
                        <button
                          className="aw-button aw-button-secondary"
                          onClick={() => setEditing(true)}
                        >
                          <MobileIcon
                            name="pencil"
                            size={17}
                            color="currentColor"
                          />
                          {copy.edit}
                        </button>
                      )}
                      {!editing && (
                        <button
                          className="aw-icon-button"
                          onClick={handleBack}
                          disabled={saving}
                          aria-label={t.agent.roomDetail.closePreview}
                        >
                          <MobileIcon
                            name="close"
                            size={20}
                            color="currentColor"
                          />
                        </button>
                      )}
                    </div>
                  </div>
                </WebContentContainer>
              </header>
              {detailError ? (
                <div className="ard-state" role="alert">
                  <MobileIcon name="warning" size={30} color="currentColor" />
                  <p>{detailError}</p>
                  <button
                    className="aw-button aw-button-secondary"
                    onClick={() => setDetailRefresh((n) => n + 1)}
                  >
                    {copy.retry}
                  </button>
                </div>
              ) : room?.id === roomId ? (
                editing ? (
                  <div className="ard-editor">
                    <WebContentContainer fill>
                      <AgentRoomEditor
                        room={room}
                        backHandlerRef={editRoomBackRef}
                        onHeaderTitleChange={setEditHeaderTitle}
                        onBusy={setSaving}
                        onCancelEdit={() => {
                          setEditing(false);
                          setEditHeaderTitle("");
                        }}
                        onSaved={(result) => {
                          setEditing(false);
                          setEditHeaderTitle("");
                          if (result?.promoCopyStale != null && room) {
                            promoStaleByRoomRef.current[room.id] = Boolean(
                              result.promoCopyStale,
                            );
                          }
                          setDetailRefresh((n) => n + 1);
                          onSaved?.();
                        }}
                      />
                    </WebContentContainer>
                  </div>
                ) : (
                  <MobileAgentRoomBody
                    mapsApiKey={Constants.expoConfig?.extra?.webGoogleMapsApiKey || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY}
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
                <div className="ard-state" role="status">
                  <span className="ard-loading-indicator" aria-hidden="true" />
                  {t.common.loading}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </Modal>
  );
}
