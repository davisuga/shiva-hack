import { LocaleSwitcher } from "@/components/locale-switcher";
import { getTranslations } from "next-intl/server";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations("AuthLayout");

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-[420px]">
          <div className="mb-4 flex justify-end">
            <LocaleSwitcher />
          </div>
          {children}
        </div>
      </div>

      <div className="hidden lg:flex items-center justify-center bg-[linear-gradient(145deg,#007aff_0%,#34c759_100%)] p-8">
        <div className="max-w-md space-y-7 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-white/20 text-[20px] font-black backdrop-blur-sm shadow-[0_2px_10px_rgba(0,0,0,0.15)]">
              N
            </div>
            <span className="text-[28px] font-extrabold tracking-[-1px]">Notia</span>
          </div>

          <div className="space-y-4">
            <h2 className="text-[24px] font-extrabold tracking-[-0.6px] leading-tight">
              {t("headline")}
            </h2>
            <p className="text-[15px] leading-relaxed text-white/85">
              {t("subtitle")}
            </p>

            <div className="space-y-3 pt-3">
              <div className="flex items-center gap-3 rounded-[14px] bg-white/10 p-3 backdrop-blur-sm">
                <span className="text-[20px]">📸</span>
                <div>
                  <p className="text-[13px] font-bold">{t("featureExtractionTitle")}</p>
                  <p className="text-[11px] text-white/70">{t("featureExtractionSubtitle")}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-[14px] bg-white/10 p-3 backdrop-blur-sm">
                <span className="text-[20px]">💰</span>
                <div>
                  <p className="text-[13px] font-bold">{t("featureSavingsTitle")}</p>
                  <p className="text-[11px] text-white/70">{t("featureSavingsSubtitle")}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-[14px] bg-white/10 p-3 backdrop-blur-sm">
                <span className="text-[20px]">🌍</span>
                <div>
                  <p className="text-[13px] font-bold">{t("featureGlobalTitle")}</p>
                  <p className="text-[11px] text-white/70">{t("featureGlobalSubtitle")}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
