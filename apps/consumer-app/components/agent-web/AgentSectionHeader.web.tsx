import React from "react";
import {
  MobileIcon,
  useMobileTheme,
  type MobileSectionHeaderProps,
} from "@nestyk/ui/native";
import { useLocale } from "@nestyk/i18n";

/** Page actions stay alongside the title; workspace navigation lives in the sidebar. */
export function AgentSectionHeader(props: MobileSectionHeaderProps) {
  const { t } = useLocale();
  const { theme } = useMobileTheme();
  return (
    <div className="aw-page-heading">
      <div className="aw-page-title">
        {props.leading === "back" && props.onBackPress ? (
          <button
            className="aw-icon-button"
            type="button"
            onClick={props.onBackPress}
            disabled={props.backDisabled}
            aria-label={t.agent.createRoom.back}
          >
            <MobileIcon
              name="chevron-left"
              size={20}
              color={theme.screenTitle}
            />
          </button>
        ) : null}
        <div className="aw-page-title-copy">
          <div className="aw-page-title-line">
            <h1>{props.title}</h1>
          </div>
          {props.workspaceLabel ? (
            <p>{props.workspaceLabel}</p>
          ) : null}
        </div>
      </div>
      <div className="aw-page-actions">
        {props.onSearchPress ? (
          <button
            className="aw-icon-button"
            type="button"
            onClick={props.onSearchPress}
            aria-label={props.searchAccessibilityLabel || t.mobile.tabs.search}
            aria-pressed={props.searchActive}
          >
            <MobileIcon name="search" size={18} color={theme.screenTitle} />
          </button>
        ) : null}
        {props.onActionPress && props.actionLabel ? (
          <button
            className="aw-button aw-button-secondary"
            type="button"
            onClick={props.onActionPress}
            disabled={props.actionDisabled}
          >
            <MobileIcon
              name={props.actionIcon || "pencil"}
              size={17}
              color={theme.screenTitle}
            />
            {props.actionLabel}
          </button>
        ) : null}
        {props.onAddPress ? (
          <button
            className="aw-button aw-button-primary"
            type="button"
            onClick={props.onAddPress}
          >
            <MobileIcon name="plus" size={17} color="#382b12" />
            {props.addAccessibilityLabel || props.addLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
