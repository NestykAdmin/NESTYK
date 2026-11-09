export type PlacesSearchAction = 'clear' | 'skip' | 'search';

/**
 * Decides what the project-name search effect should do.
 * `appliedName` is the last name the app filled in itself (saved name on edit, or a picked place),
 * so it is not searched again; any other name of 2+ characters is searched.
 */
export function placesSearchAction(query: string, appliedName: string | null): PlacesSearchAction {
  const trimmed = query.trim();
  if (trimmed.length < 2) return 'clear';
  if (appliedName != null && trimmed === appliedName.trim()) return 'skip';
  return 'search';
}
