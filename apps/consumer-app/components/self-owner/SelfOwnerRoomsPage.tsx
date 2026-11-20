import React from 'react';
import { MobileSelfOwnerRoomsScreen } from './MobileSelfOwnerRoomsScreen';
import type { SelfOwnerRoomsPageProps } from './SelfOwnerRoomsPage.types';

/** Platform fallback: native keeps the phone list; the web table and its CSS stay out of native bundles. */
export function SelfOwnerRoomsPage(props: SelfOwnerRoomsPageProps) {
  return <MobileSelfOwnerRoomsScreen {...props} />;
}
