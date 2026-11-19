import React from 'react';
import { MobileSelfOwnerDashboardBody } from './MobileSelfOwnerDashboardBody';
import type { SelfOwnerOverviewProps } from './SelfOwnerOverview.types';

/** Platform fallback: the desktop page and its CSS stay out of native bundles (same split as AgentOverview). */
export function SelfOwnerOverview(props: SelfOwnerOverviewProps) {
  return <MobileSelfOwnerDashboardBody snapshot={props.snapshot} deletionScheduledFor={props.deletionScheduledFor} />;
}
