import React from 'react';
import { MobileSelfOwnerIncomeScreen } from './MobileSelfOwnerIncomeScreen';
import type { SelfOwnerIncomePageProps } from './SelfOwnerIncomePage.types';

/** Platform fallback: native keeps the phone screen; the web table and its CSS stay out of native bundles. */
export function SelfOwnerIncomePage(props: SelfOwnerIncomePageProps) {
  return <MobileSelfOwnerIncomeScreen {...props} />;
}
