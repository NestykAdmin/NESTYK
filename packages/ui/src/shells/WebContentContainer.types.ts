import type { ReactNode } from 'react';

export interface WebContentContainerProps {
  children: ReactNode;
  /** Fill available height; delegate to inner content boundaries when the page owns a scroll viewport. */
  fill?: boolean;
}
