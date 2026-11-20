import React, { useCallback, useMemo, useRef, useState } from "react";
import { Modal } from "react-native";
import { WebContentContainer } from "@nestyk/ui/web-content";
import { AgentRoomDesktopBody, interpolate } from "@nestyk/feature-listing";
import { MobileIcon, useMobileTheme } from "@nestyk/ui/native";
import { useLocale } from "@nestyk/i18n";
import "../agent-web/agent-room-detail.css";
import { WebDialog } from "../agent-web/ui/WebDialog";
import { canToggleListing, toggleListing, useSelfOwnerRooms } from "../../lib/self-owner-rooms";
import { roomDetailFromSelfOwner, selfOwnerListingDrafts } from "../../lib/self-owner-listing";
import { SelfOwnerListingEditor } from "./SelfOwnerListingEditor";
import type { SelfOwnerRoomDetailModalProps } from "./SelfOwnerRoomDetailModal.types";

/**
 * Self owner room detail over the rooms page (Jom 20 Nov 2026), like the agent's AgentRoomDetailModal.web.tsx:
 * the agent room detail page without the share bar, edit in the modal, and publish / unpublish in the header
 * (asks first). Demo store only.
 */
export function SelfOwnerRoomDetailModal({ roomId, onClose, ownerContact }: SelfOwnerRoomDetailModalProps) {
  const { t } = useLocale();
  const { theme } = useMobileTheme();
  const copy = t.agent.listings;
  const so = t.selfOwnerRooms;
  const { rooms } = useSelfOwnerRooms();
  const room = roomId ? rooms.find((item) => item.id === roomId) ?? null : null;
  const detail = useMemo(() => (room ? roomDetailFromSelfOwner(room, selfOwnerListingDrafts.get(room.id)) : null), [room]);

  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
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
  }, [onClose, stopEditing]);
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
  }, [confirming, editing, stopEditing, close]);

  // Escape inside the publish confirm belongs to the confirm (its <dialog> closes itself), not to this modal.
  const dialogEscape = useRef(false);
  const listed = room?.state === "listed";
  const toggleLabel = listed ? so.unpublish : so.publish;

  return (
    <Modal visible={roomId !== null} transparent animationType="none" onRequestClose={handleBack} accessibilityLabel={editing ? editHeaderTitle || copy.editRoom : copy.details}>
      <div className="ard-modal-backdrop">
        <section
          className="aw-shell ard-dialog"
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
          <header className="ard-header">
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
                  {room && !editing && canToggleListing(room) ? (
                    <button className="aw-button aw-button-secondary" data-testid="sord-toggle" onClick={() => setConfirming(true)}>
                      <MobileIcon name="globe" size={17} color="currentColor" />
                      {toggleLabel}
                    </button>
                  ) : null}
                  {room && !editing ? (
                    <button className="aw-button aw-button-secondary" data-testid="sord-edit" onClick={() => setEditing(true)}>
                      <MobileIcon name="pencil" size={17} color="currentColor" />
                      {copy.edit}
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
          {!room || !detail ? (
            <div className="ard-state" role="alert">
              <MobileIcon name="warning" size={30} color="currentColor" />
              <p>{so.noMatch}</p>
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
              mapsApiKey={process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY}
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
                  onClick={() => {
                    if (room) toggleListing(room.id);
                    setConfirming(false);
                  }}
                >
                  {toggleLabel}
                </button>
              </>
            }
          >
            {room ? <p className="sor-confirm">{interpolate(listed ? so.unpublishConfirm : so.publishConfirm, { title: room.title })}</p> : null}
          </WebDialog>
        </section>
      </div>
    </Modal>
  );
}
