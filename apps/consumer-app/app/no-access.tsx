// Route access (project-docs/nestyk-route-access-design.md, 5 Nov 2026): signed in, but the account has none of this
// web portal's roles (EXPO_PUBLIC_WEB_PORTAL). Web only; mobile goes home.
import React from 'react';
import { NoAccessScreen } from '../components/web-access/NoAccessScreen';

export default function NoAccessRoute() {
  return <NoAccessScreen />;
}
