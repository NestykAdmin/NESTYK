import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { startGoogleOAuth, type GoogleSession } from './google-oauth';

WebBrowser.maybeCompleteAuthSession();

type GoogleClient = Parameters<typeof startGoogleOAuth>[0];

/** Opens Google. Web navigates away; the app finishes sign-in when it loads again. */
export function signInWithGoogle(supabase: GoogleClient): Promise<GoogleSession | null> {
  const redirectTo = Platform.OS === 'web' ? window.location.origin : Linking.createURL('auth');
  return startGoogleOAuth(supabase, {
    platform: Platform.OS === 'web' ? 'web' : 'native',
    redirectTo,
    openAuthSession: (url, returnUrl) => WebBrowser.openAuthSessionAsync(url, returnUrl),
  });
}
