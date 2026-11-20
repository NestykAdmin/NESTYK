// Room page section tabs (S7.3, Mos 19 Nov 2026): which section the reader is in.
export interface SectionTop {
  id: string;
  /** Distance from the top of the viewport to the top of the section, in px. */
  top: number;
}

/**
 * The active section is the last one whose top has reached `line` (the bottom edge of the sticky header and tabs).
 * Before the first section reaches it, the first section is active. At the bottom of the page the last section is
 * active, because a short last section may never reach the line.
 */
export function activeSectionId(sections: readonly SectionTop[], line: number, atBottom = false): string | null {
  if (!sections.length) return null;
  if (atBottom) return sections[sections.length - 1].id;
  let active = sections[0].id;
  for (const section of sections) {
    if (section.top <= line) active = section.id;
  }
  return active;
}
