import { th } from './locales/th';
import { en } from './locales/en';
import { zh } from './locales/zh';
import { ja } from './locales/ja';
import { SupportedLocale, TranslationSchema } from './types';

export const locales: Record<SupportedLocale, TranslationSchema> = {
  th,
  en,
  zh,
  ja,
};

export function getTranslations(locale: SupportedLocale = 'th'): TranslationSchema {
  return locales[locale] || locales.th;
}

export * from './LocaleContext';
export * from './error-message';
export * from './resolveLocale';
export * from './template';
export * from './types';
export {
  AMENITIES_CATALOG_GROUP_ORDER,
  AMENITIES_FACILITY_GROUP_LABELS,
  AMENITIES_FACILITY_LABELS,
} from './amenities-catalog-labels';
