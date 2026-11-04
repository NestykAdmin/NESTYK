import React, { useEffect, useRef } from "react";
import { MobileIcon, useMobileTheme } from "@nestyk/ui/native";
import { useLocale } from "@nestyk/i18n";
import "./agent-web-ui.css";

export interface WebDialogProps {
  open: boolean;
  title: string;
  /** Esc, the close button and a click on the backdrop all call this. */
  onClose: () => void;
  description?: string;
  /** Buttons row (primary last). */
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  testID?: string;
  children?: React.ReactNode;
}

/** Short tasks over the current page (view, confirm, quick form). Long or multi-step work is a page, not a dialog. */
export function WebDialog(props: WebDialogProps) {
  const { t } = useLocale();
  const { theme } = useMobileTheme();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = `awu-dialog-${props.testID ?? "title"}`;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (props.open && !dialog.open) dialog.showModal();
    if (!props.open && dialog.open) dialog.close();
  }, [props.open]);

  return (
    <dialog
      ref={ref}
      className={`awu-dialog awu-dialog-${props.size ?? "md"}`}
      aria-labelledby={titleId}
      data-testid={props.testID}
      onCancel={(event) => {
        event.preventDefault();
        props.onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) props.onClose();
      }}
    >
      {props.open ? (
        <div className="awu-dialog-panel">
          <div className="awu-dialog-head">
            <h2 id={titleId}>{props.title}</h2>
            <button
              type="button"
              className="aw-icon-button"
              onClick={props.onClose}
              aria-label={t.agent.dashboard.webWorkspace.close}
            >
              <MobileIcon name="close" size={20} color={theme.screenTitle} />
            </button>
          </div>
          {props.description ? <p className="awu-dialog-desc">{props.description}</p> : null}
          <div className="awu-dialog-body">{props.children}</div>
          {props.footer ? <div className="awu-dialog-foot">{props.footer}</div> : null}
        </div>
      ) : null}
    </dialog>
  );
}
