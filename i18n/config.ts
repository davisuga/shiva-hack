export const locales = ["pt", "en"] as const;

export type AppLocale = (typeof locales)[number];

export const defaultLocale: AppLocale = "pt";
export const localeCookieName = "notia-locale";

export const localeToLanguageTag: Record<AppLocale, string> = {
  pt: "pt-BR",
  en: "en-US",
};

export function isAppLocale(value: string): value is AppLocale {
  return locales.includes(value as AppLocale);
}
