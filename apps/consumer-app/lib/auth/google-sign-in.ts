import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { startGoogleOAuth, type GoogleSession } from './google-oauth';

WebBrowser.maybeCompleteAuthSession();

type GoogleClient = Parameters<typeof startGoogleOAuth>[0];

function redirectTo(): string {
  return Platform.OS === 'web' ? window.location.origin : Linking.createURL('auth');
}

function openProvider(provider: 'google' | 'facebook') {
  return (supabase: GoogleClient): Promise<GoogleSession | null> => startGoogleOAuth(supabase, {
    platform: Platform.OS === 'web' ? 'web' : 'native',
    redirectTo: redirectTo(),
    provider,
    openAuthSession: (url, returnUrl) => WebBrowser.openAuthSessionAsync(url, returnUrl),
  });
}

/** Opens Google. Web navigates away; the app finishes sign-in when it loads again. */
export function signInWithGoogle(supabase: GoogleClient): Promise<GoogleSession | null> {
  return openProvider('google')(supabase);
}

/** Opens Facebook. Web navigates away; the app finishes sign-in when it loads again. */
export function signInWithFacebook(supabase: GoogleClient): Promise<GoogleSession | null> {
  return openProvider('facebook')(supabase);
}
