"use server";

import { cookies } from "next/headers";
import {
  defaultLocale,
  isAppLocale,
  localeCookieName,
  type AppLocale,
} from "@/i18n/config";

export async function setUserLocale(nextLocale: string) {
  const locale: AppLocale = isAppLocale(nextLocale) ? nextLocale : defaultLocale;

  const cookieStore = await cookies();
  cookieStore.set(localeCookieName, locale, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });

  return { success: true, locale };
}
