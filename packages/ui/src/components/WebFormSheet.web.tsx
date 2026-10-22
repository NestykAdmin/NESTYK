import React, { useEffect, useRef } from "react";
import { useLocale } from "@nestyk/i18n";
import { useMobileTheme } from "../theme/ThemeContext";
import type { MobileBottomSheetProps } from "./MobileBottomSheet";
import type { WebFormSheetProps } from "./WebFormLayout.types";
import "./web-form-dialog.css";
import { MobileIcon } from "../icons/MobileIcon";

/** Replace only the presentation of a shared sheet, preserving its form and callbacks. */
export function WebFormSheet({
  children,
  enabled = true,
  label,
  showClose = false,
}: WebFormSheetProps) {
  const sheet = React.isValidElement<MobileBottomSheetProps>(children)
    ? children
    : null;
  return enabled && sheet ? (
    <DesktopFormDialog {...sheet.props} label={label} showClose={showClose} />
  ) : (
    <>{children}</>
  );
}
function DesktopFormDialog({
  visible,
  onClose,
  children,
  closeOnBackdropPress = true,
  testID,
  label,
  showClose,
}: MobileBottomSheetProps & { label?: string; showClose?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { theme } = useMobileTheme();
  const { locale } = useLocale();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (visible && !dialog.open) dialog.showModal();
    if (!visible && dialog.open) dialog.close();
  }, [visible]);
  return (
    <dialog
      ref={ref}
      className="awf-dialog"
      aria-modal="true"
      aria-label={label || (locale === "th" ? "รายละเอียด" : "Details")}
      data-testid={testID}
      style={{ backgroundColor: theme.card, color: theme.textHeading }}
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
      onClick={(event) => {
        if (closeOnBackdropPress && event.target === event.currentTarget) {
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            onClose();
        }
      }}
    >
      {visible && showClose && (
        <button
          className="awf-dialog-close aw-icon-button"
          type="button"
          aria-label={locale === "th" ? "ปิด" : "Close"}
          onClick={onClose}
        >
          <MobileIcon name="close" size={20} color="currentColor" />
        </button>
      )}
      {visible ? children : null}
    </dialog>
  );
}
