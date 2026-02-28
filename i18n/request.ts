import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import {
  defaultLocale,
  isAppLocale,
  localeCookieName,
  type AppLocale,
} from "./config";

function detectLocaleFromAcceptLanguage(acceptLanguage: string | null): AppLocale | null {
  if (!acceptLanguage) return null;

  const candidates = acceptLanguage
    .split(",")
    .map((part) => part.trim().split(";")[0]?.toLowerCase())
    .filter((part): part is string => Boolean(part));

  for (const candidate of candidates) {
    if (candidate.startsWith("pt")) return "pt";
    if (candidate.startsWith("en")) return "en";
  }

  return null;
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const headerStore = await headers();

  const cookieLocale = cookieStore.get(localeCookieName)?.value;
  const headerLocale = detectLocaleFromAcceptLanguage(
    headerStore.get("accept-language")
  );

  const locale =
    (cookieLocale && isAppLocale(cookieLocale) ? cookieLocale : null) ||
    headerLocale ||
    defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
