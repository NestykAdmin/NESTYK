import React from 'react';
import { MobileSelfOwnerContractsScreen } from './MobileSelfOwnerContractsScreen';
import type { SelfOwnerContractsPageProps } from './SelfOwnerContractsPage.types';

/** Platform fallback: native keeps the phone list; the web table and its CSS stay out of native bundles. */
export function SelfOwnerContractsPage(props: SelfOwnerContractsPageProps) {
  return <MobileSelfOwnerContractsScreen {...props} />;
}
