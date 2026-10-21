import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export function isSupabaseConfigured(): boolean {
  return Boolean(url && anonKey && !url.includes('your-project-ref') && !anonKey.includes('eyJhbGciOi...'));
}

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!client) {
    client = createClient(url, anonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
    if (Platform.OS !== 'web') {
      // On a phone, Supabase assumes the app is always in the foreground. Tell it when the app
      // goes to the background (stop refreshing) and when it comes back (refresh straight away,
      // so the access token that expired while the app was away is replaced before the next API call).
      const supabase = client;
      AppState.addEventListener('change', (state) => {
        if (state === 'active') void supabase.auth.startAutoRefresh();
        else void supabase.auth.stopAutoRefresh();
      });
    }
  }
  return client;
}
