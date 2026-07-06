export type LanguageCode = 'it' | 'en';

export const SUPPORTED_LANGUAGES: readonly LanguageCode[] = ['it', 'en'];

const LANGUAGE_LABELS: Record<LanguageCode, string> = {
  it: 'Italiano',
  en: 'Inglese',
};

export function languageLabel(language: LanguageCode): string {
  return LANGUAGE_LABELS[language];
}
