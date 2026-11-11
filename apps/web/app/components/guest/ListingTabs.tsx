'use client';

import React, { useId, useRef, useState } from 'react';

export interface ListingTab {
  id: string;
  label: string;
  /** Rendered on the server; this component only switches which panel is shown. */
  panel: React.ReactNode;
}

/**
 * Tabs of "ประกาศแนะนำสำหรับคุณ" (S3.3). All panels arrive from the server; switching never calls the API.
 * Keyboard: arrow keys, Home and End move between tabs (WAI-ARIA tabs pattern).
 */
export function ListingTabs({ label, tabs, testId }: { label: string; tabs: ListingTab[]; testId?: string }) {
  const [active, setActive] = useState(tabs[0]?.id ?? '');
  const baseId = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  const focusTab = (index: number) => {
    const next = (index + tabs.length) % tabs.length;
    setActive(tabs[next].id);
    buttons.current[next]?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    if (event.key === 'ArrowRight') focusTab(index + 1);
    else if (event.key === 'ArrowLeft') focusTab(index - 1);
    else if (event.key === 'Home') focusTab(0);
    else if (event.key === 'End') focusTab(tabs.length - 1);
    else return;
    event.preventDefault();
  };

  return (
    <div className="nk-tabs" data-testid={testId}>
      <div role="tablist" aria-label={label} className="nk-tabs__list">
        {tabs.map((tab, index) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              ref={(node) => {
                buttons.current[index] = node;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              className="nk-chip-tab"
              onClick={() => setActive(tab.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
              data-testid={`${testId ?? 'tabs'}.${tab.id}`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${baseId}-panel-${tab.id}`}
          aria-labelledby={`${baseId}-tab-${tab.id}`}
          hidden={tab.id !== active}
          className="nk-tabs__panel"
        >
          {tab.panel}
        </div>
      ))}
    </div>
  );
}
