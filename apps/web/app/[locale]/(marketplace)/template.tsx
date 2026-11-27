import React from 'react';

/**
 * A new wrapper for every page change (Next remounts a template), so a page that comes in can move: guest.css moves
 * .nk-route when <html data-nk-enter> is set (page change animation design A, Mos 27 Nov 2026), where the browser has
 * no view transitions or the change came from Back.
 */
export default function MarketplaceTemplate({ children }: { children: React.ReactNode }) {
  return <div className="nk-route">{children}</div>;
}
