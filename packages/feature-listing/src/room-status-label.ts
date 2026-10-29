/** D8: "soon vacant (free 1 Nov 2027)" when the day is known. */
export function roomStatusLabel(
  copy: Record<string, unknown> & { soonVacantFrom: string; notSpecified: string },
  code: string | null,
  vacantFrom: string | null | undefined,
  locale: string,
) {
  const day = vacantFrom && /^\d{4}-\d{2}-\d{2}$/.test(vacantFrom) ? new Date(`${vacantFrom}T00:00:00Z`) : null;
  if (code === 'soon_vacant' && day && !Number.isNaN(day.getTime())) {
    const date = new Intl.DateTimeFormat(locale === 'th' ? 'th-TH' : locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(day);
    return copy.soonVacantFrom.replace('{date}', date);
  }
  const label = code ? copy[code] : undefined;
  return typeof label === 'string' ? label : code || copy.notSpecified;
}
