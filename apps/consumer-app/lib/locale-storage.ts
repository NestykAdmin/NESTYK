import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSupportedLocale, type SupportedLocale } from '@nestyk/i18n';
import { cookieConsentAllows } from '@nestyk/ui/cookie-consent';

const PREFERRED_LOCALE_KEY = '@nestyk/preferred_locale';

/** Returns a previously chosen app language, or null if never saved. */
export async function loadPreferredLocale(): Promise<SupportedLocale | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFERRED_LOCALE_KEY);
    return isSupportedLocale(raw) ? raw : null;
  } catch {
    return null;
  }
}

/** Persist the user's language choice for the next launch. */
export async function savePreferredLocale(locale: SupportedLocale): Promise<void> {
  // Web PDPA cookie consent: kept only when "Remember my settings" is allowed (always true on the phone).
  if (!cookieConsentAllows('preferences')) return;
  try {
    await AsyncStorage.setItem(PREFERRED_LOCALE_KEY, locale);
  } catch {
    // Non-fatal — UI locale still updates in memory.
  }
}
