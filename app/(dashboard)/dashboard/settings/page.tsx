import { requireAuth } from "@/lib/auth-server";
import { getTranslations } from "next-intl/server";

const inputClass =
  "w-full rounded-[10px] border border-[rgba(0,0,0,0.07)] bg-notia-bg px-3.5 py-2.5 text-[14px] text-notia-text outline-none disabled:opacity-60";

export default async function SettingsPage() {
  const session = await requireAuth();
  const t = await getTranslations("SettingsPage");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[22px] font-extrabold tracking-[-0.6px] text-notia-text">{t("title")}</h1>
        <p className="mt-1 text-[13px] text-notia-text-secondary">{t("subtitle")}</p>
      </div>

      <div className="rounded-[24px] border border-[rgba(0,0,0,0.07)] bg-white p-[20px_22px] shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.7px] text-notia-text-muted">{t("profileTag")}</p>
        <p className="mb-4 text-[16px] font-extrabold tracking-[-0.4px] text-notia-text">{t("profileTitle")}</p>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-[12px] font-bold uppercase tracking-[0.5px] text-notia-text-muted">{t("nameLabel")}</label>
            <input value={session.user.name || ""} disabled className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <label className="text-[12px] font-bold uppercase tracking-[0.5px] text-notia-text-muted">{t("emailLabel")}</label>
            <input value={session.user.email} disabled className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <label className="text-[12px] font-bold uppercase tracking-[0.5px] text-notia-text-muted">{t("userIdLabel")}</label>
            <input value={session.user.id} disabled className={`${inputClass} font-mono text-[12px]`} />
          </div>
        </div>
      </div>

      <div className="rounded-[24px] border border-[rgba(0,0,0,0.07)] bg-white p-[20px_22px] shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.7px] text-notia-text-muted">{t("soonTag")}</p>
        <p className="text-[16px] font-extrabold tracking-[-0.4px] text-notia-text">{t("preferencesTitle")}</p>
        <p className="mt-3 text-center text-[13px] text-notia-text-muted py-8">{t("preferencesDescription")}</p>
      </div>
    </div>
  );
}
