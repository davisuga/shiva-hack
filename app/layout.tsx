import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import {
  defaultLocale,
  isAppLocale,
  localeToLanguageTag,
  type AppLocale,
} from "@/i18n/config";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Notia",
  description: "Turn receipts into purchase intelligence.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const requestedLocale = await getLocale();
  const locale: AppLocale = isAppLocale(requestedLocale)
    ? requestedLocale
    : defaultLocale;
  const messages = await getMessages();

  return (
    <html lang={localeToLanguageTag[locale]}>
      <body className={`${outfit.variable} antialiased`}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
