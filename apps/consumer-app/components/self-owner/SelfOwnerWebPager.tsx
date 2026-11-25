import React from "react";
import { useLocale } from "@nestyk/i18n";
import { MobileIcon } from "@nestyk/ui/native";
import { SELF_OWNER_LOCALE_TAG } from "../../lib/self-owner-dashboard";
import { pageButtons } from "../../lib/self-owner-rooms";

/**
 * The desktop pager of the self owner lists, the same markup and words as "my rooms" (SelfOwnerRoomsPage.web.tsx):
 * "from–to of total", then page buttons when there is more than one page (Jom 25 Nov 2026: documents and income).
 */
export function SelfOwnerWebPager({ current, pages, total, size, onPage }: { current: number; pages: number; total: number; size: number; onPage: (page: number) => void }) {
  const { t, locale } = useLocale();
  const web = t.agent.listings.web;
  const tag = SELF_OWNER_LOCALE_TAG[locale as keyof typeof SELF_OWNER_LOCALE_TAG] ?? SELF_OWNER_LOCALE_TAG.th;
  const number = (value: number) => value.toLocaleString(tag);
  if (total <= 0) return null;
  const from = (current - 1) * size + 1;
  const to = Math.min(current * size, total);
  return (
    <nav className="awr-pager" aria-label={web.pages}>
      <span className="awr-pager-range">
        {web.pageRange.replace("{from}", number(from)).replace("{to}", number(to)).replace("{total}", number(total))}
      </span>
      {pages > 1 ? (
        <span className="awr-pager-buttons">
          <button type="button" className="awr-page-btn" onClick={() => onPage(current - 1)} disabled={current <= 1} aria-label={web.prevPage}>
            <MobileIcon name="chevron-left" size={16} color="currentColor" />
          </button>
          {pageButtons(current, pages).map((n, i) =>
            n == null ? (
              <span key={`gap-${i}`} className="awr-page-gap" aria-hidden="true">
                …
              </span>
            ) : (
              <button
                key={n}
                type="button"
                className={`awr-page-btn${n === current ? " is-current" : ""}`}
                aria-current={n === current ? "page" : undefined}
                onClick={() => onPage(n)}
              >
                {number(n)}
              </button>
            ),
          )}
          <button type="button" className="awr-page-btn" onClick={() => onPage(current + 1)} disabled={current >= pages} aria-label={web.nextPage}>
            <MobileIcon name="chevron-right" size={16} color="currentColor" />
          </button>
        </span>
      ) : null}
    </nav>
  );
}
