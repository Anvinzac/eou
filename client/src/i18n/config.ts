import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import vi from './locales/vi.json';

export const LANGUAGE_STORAGE_KEY = 'eou_language';

export function getPreferredLanguage(): 'vi' | 'en' {
  try {
    return localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'en' ? 'en' : 'vi';
  } catch {
    return 'vi';
  }
}

function syncLanguage(language: string) {
  const locale = language.startsWith('vi') ? 'vi' : 'en';
  document.documentElement.lang = locale;
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, locale);
  } catch {
    // Language switching still works when browser storage is unavailable.
  }
}

i18n.on('languageChanged', syncLanguage);
i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      vi: { translation: vi }
    },
    lng: getPreferredLanguage(),
    supportedLngs: ['vi', 'en'],
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
