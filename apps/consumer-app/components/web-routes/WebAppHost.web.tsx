import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Redirect, usePathname } from 'expo-router';
import { AppHomeScreen } from '../../app/index';
import { parseAppPath } from '../../lib/app-routes';

/**
 * Web: the app shell lives in the root layout and is not remounted when the path changes or the browser goes
 * back/forward (route plan rule 21, checked in T0-B). Auth screens (login, register) are their own routes, so the
 * shell steps aside for them. Unknown paths fall through to the catch-all route ("Unmatched").
 */
export default function WebAppHost() {
  const parsed = parseAppPath(usePathname());
  if (parsed.kind === 'redirect') return <Redirect href={parsed.to as never} />;
  if (parsed.kind !== 'app') return null;
  return (
    <View style={StyleSheet.absoluteFill}>
      <AppHomeScreen />
    </View>
  );
}
