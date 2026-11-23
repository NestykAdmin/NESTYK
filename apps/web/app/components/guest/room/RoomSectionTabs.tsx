'use client';

import React, { useEffect, useRef, useState } from 'react';
import { activeSectionId } from '../../../../lib/guest-room-sections';

export interface RoomSection {
  id: string;
  label: string;
}

// Space under the sticky bars before a section counts as the one being read. It must be more than the gap that
// scroll-margin-top in guest.css leaves (desktop 140px - 122px of bars, mobile 72px - ~61px), so a tab click lands on its tab.
const LINE_GAP = 24;
// After a tab click the page scrolls past other sections; keep the clicked tab until scrolling stops this long.
const SETTLE_MS = 150;

/** Sticky section tabs of the room page. One page, no tab panels: the tab of the section in view is marked. */
export function RoomSectionTabs({ sections, label }: { sections: readonly RoomSection[]; label: string }) {
  const navRef = useRef<HTMLElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(sections[0]?.id ?? '');
  const clickedRef = useRef(false);

  useEffect(() => {
    let frame = 0;
    let settle = 0;
    const update = () => {
      frame = 0;
      const nav = navRef.current;
      if (!nav) return;
      const line = nav.getBoundingClientRect().bottom + LINE_GAP;
      const tops = sections.flatMap((section) => {
        const el = document.getElementById(section.id);
        return el ? [{ id: section.id, top: el.getBoundingClientRect().top }] : [];
      });
      const doc = document.documentElement;
      const atBottom = window.innerHeight + window.scrollY >= doc.scrollHeight - 2;
      const next = activeSectionId(tops, line, atBottom);
      if (next) setActive(next);
    };
    const schedule = () => {
      if (clickedRef.current) {
        window.clearTimeout(settle);
        settle = window.setTimeout(() => {
          clickedRef.current = false;
          update();
        }, SETTLE_MS);
        return;
      }
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame) window.cancelAnimationFrame(frame);
      window.clearTimeout(settle);
    };
  }, [sections]);

  // Mobile chips scroll sideways: keep the active one in view without moving the page.
  useEffect(() => {
    const inner = innerRef.current;
    const link = inner?.querySelector<HTMLElement>(`a[href="#${active}"]`);
    if (!inner || !link || inner.scrollWidth <= inner.clientWidth) return;
    const left = link.offsetLeft - (inner.clientWidth - link.offsetWidth) / 2;
    inner.scrollTo({ left: Math.max(0, left), behavior: reducedMotion() ? 'auto' : 'smooth' });
  }, [active]);

  const onClick = (event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    const target = document.getElementById(id);
    if (!target || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    // scroll-margin-top on the sections keeps them clear of the sticky bars.
    target.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
    window.history.replaceState(window.history.state, '', `#${id}`);
    clickedRef.current = true;
    setActive(id);
    // Starts the settle timer even when the page is already in place and no scroll event follows.
    window.dispatchEvent(new Event('scroll'));
  };

  return (
    <nav ref={navRef} className="nk-rp-tabs" aria-label={label}>
      <div ref={innerRef} className="nk-rp-tabs__inner">
        {sections.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            aria-current={active === section.id ? 'location' : undefined}
            onClick={(event) => onClick(event, section.id)}
          >
            {section.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

function reducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
