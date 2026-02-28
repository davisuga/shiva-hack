import { getTranslations } from "next-intl/server";

export default async function AnalyticsPage() {
  const t = await getTranslations("AnalyticsPage");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[22px] font-extrabold tracking-[-0.6px] text-notia-text">{t("title")}</h1>
        <p className="mt-1 text-[13px] text-notia-text-secondary">{t("subtitle")}</p>
      </div>

      <div className="rounded-[24px] border border-[rgba(0,0,0,0.07)] bg-white p-[20px_22px] shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.7px] text-notia-text-muted">{t("soonTag")}</p>
        <p className="text-[16px] font-extrabold tracking-[-0.4px] text-notia-text">{t("cardTitle")}</p>
        <p className="mt-3 text-center text-[13px] text-notia-text-muted py-10">{t("description")}</p>
      </div>
    </div>
  );
}
