import type { AuthEventReason, CrossTabAction } from './cross-tab-rules';

/** Mobile: one app, one "tab" — nothing to keep in step (frozen app, unchanged). */
export function markAuthEvent(_reason: AuthEventReason): void {}

export function subscribeCrossTab(_onAction: (action: CrossTabAction, raw: string | null) => void, _currentUserId: () => string | null): () => void {
  return () => undefined;
}
