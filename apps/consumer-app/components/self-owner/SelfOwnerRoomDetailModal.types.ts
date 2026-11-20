export interface SelfOwnerRoomDetailModalProps {
  /** Room to show (self owner room id, e.g. "r5"); null keeps the modal closed. */
  roomId: string | null;
  onClose: () => void;
  /** The owner's profile contact for the edit form. */
  ownerContact?: { name: string; phone: string };
}
