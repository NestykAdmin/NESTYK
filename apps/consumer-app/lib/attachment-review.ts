import type { AgreementAttachment, AgreementAttachmentChecklist, RejectedAttachmentNotice } from "@nestyk/types";
import { fillTemplate } from "@nestyk/i18n";

export type AttachmentReviewCopy = {
  pending: string;
  accepted: string;
  rejected: string;
  rejectedWithNote: string;
};

/** One line under a file: whether the agent has checked it (`POST .../attachments/:documentId/review`). */
export function attachmentReviewText(document: AgreementAttachment, copy: AttachmentReviewCopy): string {
  if (document.reviewStatus === "accepted") return copy.accepted;
  if (document.reviewStatus === "rejected")
    return document.reviewNote?.trim() ? fillTemplate(copy.rejectedWithNote, { note: document.reviewNote.trim() }) : copy.rejected;
  return copy.pending;
}

/** The API reviews a file once, only while documents can still change, and only the current version. */
export function canReviewAttachment(document: AgreementAttachment, editable: boolean): boolean {
  return editable && document.isCurrent && document.reviewStatus === "pending";
}

/**
 * B3 (Aof, 21 Oct 2026): current attachments the agent rejected, so whoever signs knows before signing.
 * Signing is not blocked. Named by document type, or by file name when the type is unknown.
 */
export function rejectedAttachments(
  checklist: Pick<AgreementAttachmentChecklist, "documents" | "documentTypes"> | null | undefined,
): RejectedAttachmentNotice[] {
  if (!checklist) return [];
  return checklist.documents
    .filter((document) => document.isCurrent && document.reviewStatus === "rejected")
    .map((document) => ({
      name: checklist.documentTypes.find((type) => type.code === document.documentTypeCode)?.nameTh || document.fileName,
      note: document.reviewNote?.trim() || null,
    }));
}
