import React, { useEffect, useRef, useState } from "react";
import { MobileIcon, useMobileTheme } from "@nestyk/ui/native";
import type { AppIconName } from "@nestyk/ui/native";
import "./agent-web-ui.css";

export interface WebMenuItem {
  key: string;
  label: string;
  icon?: AppIconName;
  onSelect?: () => void;
  disabled?: boolean;
  /** Small text after the label, e.g. the "Coming soon" copy. */
  badge?: string;
  /** Set for choice lists (language, role): shows ✓ and uses menuitemradio. */
  checked?: boolean;
  testID?: string;
}

export interface WebMenuProps {
  /** Accessible name of the trigger. */
  label: string;
  trigger: React.ReactNode;
  items: WebMenuItem[];
  align?: "start" | "end";
  triggerClassName?: string;
  testID?: string;
}

/** Click-to-open menu (quick create, language, row actions, account). Closes on Esc, outside click or choosing. */
export function WebMenu(props: WebMenuProps) {
  const { theme } = useMobileTheme();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // QA web test (4 Nov 2026) item 10.
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
      // The click that closes the menu only closes it: it must not also press what lies under it (it opened
      // /agent/leads from the dashboard). Swallow that one click; if no click follows (a drag), stop waiting.
      const swallow = (click: MouseEvent) => {
        click.preventDefault();
        click.stopPropagation();
      };
      document.addEventListener("click", swallow, { capture: true, once: true });
      document.addEventListener(
        "mouseup",
        () => window.setTimeout(() => document.removeEventListener("click", swallow, { capture: true }), 0),
        { once: true },
      );
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      // Keyboard users go back to the button that opened the menu, not to the page body.
      triggerRef.current?.focus();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    listRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const moveFocus = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const items = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [],
    );
    if (!items.length) return;
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === "Home" ? 0
        : event.key === "End" ? items.length - 1
          : event.key === "ArrowDown" ? (index + 1) % items.length
            : (index - 1 + items.length) % items.length;
    items[next].focus();
  };

  return (
    <div className="awu-menu" ref={rootRef} data-testid={props.testID}>
      <button
        ref={triggerRef}
        type="button"
        className={props.triggerClassName ?? "aw-button aw-button-secondary"}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={props.label}
        onClick={() => setOpen(!open)}
      >
        {props.trigger}
      </button>
      {open ? (
        <div
          ref={listRef}
          role="menu"
          aria-label={props.label}
          className={`awu-menu-list awu-menu-${props.align ?? "end"}`}
          onKeyDown={moveFocus}
        >
          {props.items.map((item) => (
            <button
              key={item.key}
              type="button"
              role={item.checked === undefined ? "menuitem" : "menuitemradio"}
              aria-checked={item.checked === undefined ? undefined : item.checked}
              className="awu-menu-item"
              disabled={item.disabled}
              data-testid={item.testID}
              onClick={() => {
                setOpen(false);
                item.onSelect?.();
              }}
            >
              {item.icon ? (
                <MobileIcon name={item.icon} size={18} color={theme.textSecondary} />
              ) : null}
              <span className="awu-menu-label">{item.label}</span>
              {item.badge ? <span className="awu-menu-badge">{item.badge}</span> : null}
              {item.checked ? (
                <MobileIcon name="check" size={16} color={theme.screenTitle} />
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
