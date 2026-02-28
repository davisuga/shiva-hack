"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { locales, type AppLocale } from "@/i18n/config";
import { setUserLocale } from "@/lib/actions/locale";

type LocaleSwitcherProps = {
  className?: string;
};

export function LocaleSwitcher({ className }: LocaleSwitcherProps) {
  const t = useTranslations("LanguageSwitcher");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <label className={className}>
      <span className="sr-only">{t("label")}</span>
      <select
        value={locale}
        disabled={isPending}
        onChange={(event) => {
          const nextLocale = event.target.value as AppLocale;
          startTransition(async () => {
            await setUserLocale(nextLocale);
            router.refresh();
          });
        }}
        className="rounded-[10px] border border-[rgba(0,0,0,0.09)] bg-white px-2 py-1.5 text-[12px] font-semibold text-notia-text outline-none disabled:opacity-60"
      >
        {locales.map((value) => (
          <option key={value} value={value}>
            {value === "pt" ? t("pt") : t("en")}
          </option>
        ))}
      </select>
    </label>
  );
}
