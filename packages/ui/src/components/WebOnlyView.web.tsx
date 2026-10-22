import React from 'react';
import { View } from 'react-native';
import type { WebOnlyViewProps } from './WebOnlyView.types';

/** Web: group scroll content while the native layout remains unchanged. */
export function WebOnlyView({ children, style }: WebOnlyViewProps) {
  return <View style={style}>{children}</View>;
}
