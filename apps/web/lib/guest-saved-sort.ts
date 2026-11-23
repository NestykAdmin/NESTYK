/**
 * Sort of the saved rooms page (Mos 20 Nov 2026, layout A). The page has every saved room already (one request),
 * so it sorts in the browser. "saved" keeps the API order: newest saved first. Pure: lib/guest-saved-page.test.cjs.
 */
export const SAVED_SORT_OPTIONS = ['saved', 'price_asc', 'price_desc'] as const;
export type SavedSort = (typeof SAVED_SORT_OPTIONS)[number];

export function isSavedSort(value: string): value is SavedSort {
  return (SAVED_SORT_OPTIONS as readonly string[]).includes(value);
}

/** A new list; rooms with no price go last; equal prices keep their saved order. */
export function sortSavedCards<T extends { priceFrom: number | null }>(cards: readonly T[], sort: SavedSort): T[] {
  if (sort === 'saved') return [...cards];
  const direction = sort === 'price_asc' ? 1 : -1;
  return cards
    .map((card, index) => ({ card, index }))
    .sort((a, b) => {
      const pa = a.card.priceFrom;
      const pb = b.card.priceFrom;
      if (pa == null || pb == null) return pa == null && pb == null ? a.index - b.index : pa == null ? 1 : -1;
      return pa === pb ? a.index - b.index : (pa - pb) * direction;
    })
    .map((entry) => entry.card);
}
