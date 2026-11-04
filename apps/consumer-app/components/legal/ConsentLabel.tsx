import React from 'react';
import { Text } from 'react-native';
import type { ConsentLabelProps } from './ConsentLabel.types';

/** Mobile: the register checkbox text stays plain text (frozen app). Web adds the document links (footer plan F3). */
export function ConsentLabel({ fallback, style }: ConsentLabelProps) {
  return <Text style={style}>{fallback}</Text>;
}
