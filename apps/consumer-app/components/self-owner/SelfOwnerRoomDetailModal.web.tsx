import React, { useCallback, useRef, useState } from "react";
import { WebSkeleton } from "../agent-web/ui/WebState";
import { Modal } from "react-native";
import { WebContentContainer } from "@nestyk/ui/web-content";
import { AgentRoomDesktopBody, interpolate } from "@nestyk/feature-listing";
import { MobileIcon, useMobileTheme } from "@nestyk/ui/native";
import { useLocale } from "@nestyk/i18n";
import "../agent-web/agent-room-detail.css";
import "./self-owner-rooms.css";
import { WebDialog } from "../agent-web/ui/WebDialog";
import { canToggleListing, selfOwnerRoomErrorCode, selfOwnerRoomStore, toggleListing, useSelfOwnerRooms } from "../../lib/self-owner-rooms";
import { useSelfOwnerRoomDetail } from "./useSelfOwnerRoomDetail";
import { SelfOwnerListingEditor } from "./SelfOwnerListingEditor";
import type { SelfOwnerRoomDetailModalProps } from "./SelfOwnerRoomDetailModal.types";
import { selfOwnerMapsApiKey } from "./self-owner-maps-key";

/**
 * Self owner room detail over the rooms page (Jom 20 Nov 2026), like the agent's AgentRoomDetailModal.web.tsx:
 * the agent room detail page without the share bar, edit in the modal, and publish / unpublish in the header
 * (asks first). Connected to the self owner API it loads the room first, and the API decides publishing.
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
  const [confirming, setConfirmingState] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const setConfirming = useCallback((open: boolean) => {
    setConfirmingState(open);
    setToggleError(null);
  }, []);
  const [editHeaderTitle, setEditHeaderTitle] = useState("");
  const editBackRef = useRef<(() => boolean) | null>(null);

  const stopEditing = useCallback(() => {
    setEditing(false);
    setEditHeaderTitle("");
  }, []);
  const close = useCallback(() => {
    stopEditing();
    setConfirming(false);
    onClose();
  }, [onClose, stopEditing, setConfirming]);
  // Like the agent: the form steps back first (section -> hub), then the form closes, then the modal.
  // An open publish confirm closes first (RN Web also calls onRequestClose on Escape).
  const handleBack = useCallback(() => {
    if (confirming) {
      setConfirming(false);
      return;
    }
    if (editing) {
      if (editBackRef.current?.()) return;
      stopEditing();
      return;
    }
    close();
  }, [confirming, editing, stopEditing, close, setConfirming]);

  // Escape inside the publish confirm belongs to the confirm (its <dialog> closes itself), not to this modal.
  const dialogEscape = useRef(false);
  const listed = room?.state === "listed";
  const toggleLabel = listed ? so.unpublish : so.publish;
  // Connected, the API decides; a room with fewer than 5 photos is told so here without asking it.
  const confirmToggle = () => {
    if (!room || toggling) return;
    if (!selfOwnerRoomStore.backend()) {
      void toggleListing(room.id);
      setConfirming(false);
      return;
    }
    if (!listed && photoCount < 5) {
      setToggleError(so.publishNeedsPhotos);
      return;
    }
    setToggling(true);
    void toggleListing(room.id).then((result) => {
      setToggling(false);
      if (result.ok) {
        setConfirming(false);
        return;
      }
      const code = selfOwnerRoomErrorCode(result.error);
      // Rented meanwhile (another device): load the rooms again so the switch goes away.
      if (code === "ROOM_RENTED") void selfOwnerRoomStore.refresh();
      setToggleError(code === "ROOM_RENTED" ? so.occupiedNoToggle : code === "PUBLISH_NEEDS_PHOTOS" ? so.publishNeedsPhotos : so.toggleFailed);
    });
  };

  return (
    <Modal visible={roomId !== null} transparent animationType="none" onRequestClose={handleBack} accessibilityLabel={editing ? editHeaderTitle || copy.editRoom : copy.details}>
      <div className="ard-modal-backdrop">
        <section
          className="aw-shell ard-dialog sord-enter"
          data-theme={theme.mode}
          onKeyDownCapture={(event) => {
            if (event.key === "Escape" && event.currentTarget.contains(event.target as Node)) {
              dialogEscape.current = confirming || Boolean(event.currentTarget.querySelector("dialog[open]"));
            }
          }}
          onKeyUpCapture={(event) => {
            if (event.key !== "Escape" || !event.currentTarget.contains(event.target as Node)) return;
            event.stopPropagation();
            if (!dialogEscape.current) handleBack();
            dialogEscape.current = false;
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
          <header className="ard-header sord-header">
            <WebContentContainer>
              <div className="ard-header-inner">
                <button className="aw-icon-button" data-testid="sord-back" onClick={handleBack} aria-label={t.agent.createRoom.back}>
                  <MobileIcon name="chevron-left" size={20} color="currentColor" />
                </button>
                <div className="ard-header-title">
                  <h1>{editing ? editHeaderTitle || copy.editRoom : copy.details}</h1>
                  {!editing && room ? <span>{room.title}</span> : null}
                </div>
                <div className="ard-header-actions">
                  {room && !editing && status === "ready" && canToggleListing(room) ? (
                    <button className="aw-button aw-button-secondary" data-testid="sord-toggle" aria-label={toggleLabel} onClick={() => setConfirming(true)}>
                      <MobileIcon name="globe" size={17} color="currentColor" />
                      <span className="sord-btn-label">{toggleLabel}</span>
                    </button>
                  ) : null}
                  {room && !editing && status === "ready" ? (
                    <button className="aw-button aw-button-secondary" data-testid="sord-edit" aria-label={copy.edit} onClick={() => setEditing(true)}>
                      <MobileIcon name="pencil" size={17} color="currentColor" />
                      <span className="sord-btn-label">{copy.edit}</span>
                    </button>
                  ) : null}
                  {!editing ? (
                    <button className="aw-icon-button" data-testid="sord-close" onClick={close} aria-label={t.agent.roomDetail.closePreview}>
                      <MobileIcon name="close" size={20} color="currentColor" />
                    </button>
                  ) : null}
                </div>
              </div>
            </WebContentContainer>
          </header>
          {room && status === "loading" ? (
            // A skeleton shaped like the detail (photos, then rows) while the API answers (Jom 25 Nov 2026).
            <div className="sord-skeleton so-skeleton-delay" aria-busy="true">
              <div className="sord-skeleton-photo" aria-hidden="true" />
              <WebSkeleton rows={4} columns={3} />
            </div>
          ) : !room || !detail ? (
            <div className="ard-state" role="alert">
              <MobileIcon name="warning" size={30} color="currentColor" />
              <p>{room && status === "error" ? so.detailLoadError : so.noMatch}</p>
            </div>
          ) : editing ? (
            <div className="ard-editor">
              <WebContentContainer fill>
                <SelfOwnerListingEditor
                  room={room}
                  backHandlerRef={editBackRef}
                  ownerContact={ownerContact}
                  onHeaderTitleChange={setEditHeaderTitle}
                  onCancel={stopEditing}
                  onDone={stopEditing}
                />
              </WebContentContainer>
            </div>
          ) : (
            <AgentRoomDesktopBody
              key={`${room.id}-${room.updatedAt}`}
              mode="agent"
              room={detail}
              ownerInternalCopy={ownerInternalCopy}
              mapsApiKey={selfOwnerMapsApiKey()}
            />
          )}
          <WebDialog
            open={confirming && !!room}
            title={toggleLabel}
            onClose={() => setConfirming(false)}
            size="sm"
            testID="sord-toggle-dialog"
            footer={
              <>
                <button type="button" className="awu-btn" onClick={() => setConfirming(false)}>
                  {t.common.cancel}
                </button>
                <button
                  type="button"
                  className="awu-btn awu-btn-primary"
                  data-testid="sord-toggle-confirm"
                  disabled={toggling}
                  aria-busy={toggling}
                  onClick={confirmToggle}
                >
                  {toggleLabel}
                </button>
              </>
            }
          >
            {room ? <p className="sor-confirm">{interpolate(listed ? so.unpublishConfirm : so.publishConfirm, { title: room.title })}</p> : null}
            {toggleError ? <p className="sor-confirm-error" role="alert">{toggleError}</p> : null}
          </WebDialog>
        </section>
      </div>
    </Modal>
  );
}
