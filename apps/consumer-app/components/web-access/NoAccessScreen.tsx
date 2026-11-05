import React from 'react';
import { Redirect } from 'expo-router';

/** Mobile: one app with every role (portal "all"), so there is no "no access" page. */
export function NoAccessScreen() {
  return <Redirect href="/" />;
}
