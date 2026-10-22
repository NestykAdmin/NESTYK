import React from 'react';
import type { WebContentContainerProps } from './WebContentContainer.types';

export type { WebContentContainerProps } from './WebContentContainer.types';

/** Web layout policy has no effect on native screens. */
export function WebContentContainer({ children }: WebContentContainerProps) {
  return <>{children}</>;
}

export function WebContentRoot({ children }: Pick<WebContentContainerProps, 'children'>) {
  return <>{children}</>;
}
