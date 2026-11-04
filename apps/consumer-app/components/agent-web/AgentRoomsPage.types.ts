export interface AgentRoomsPageProps {
  /** Bumped by the shell after a room is created or edited elsewhere: the page loads again. */
  reloadToken?: number;
  onReloadSettled?: (token: number) => void;
  /** The empty state's "Add room" button. */
  onAddRoom?: () => void;
}
