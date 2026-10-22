import React from 'react';
import type { WebOnlyViewProps } from './WebOnlyView.types';

/** Native: preserve the existing children without adding a View or applying styles. */
export function WebOnlyView({ children }: WebOnlyViewProps) {
  return <>{children}</>;
}
