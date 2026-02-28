"use client";

import { useState } from "react";
import { signUp } from "@/lib/auth-client";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";

const inputClass = "w-full rounded-[10px] border border-[rgba(0,0,0,0.07)] bg-notia-bg px-3.5 py-2.5 text-[14px] text-notia-text outline-none transition placeholder:text-notia-text-muted focus:border-[rgba(0,122,255,0.4)] focus:shadow-[0_0_0_3px_rgba(0,122,255,0.1)] disabled:opacity-50";

export default function SignUp() {
  const t = useTranslations("AuthSignUp");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <div className="animate-fade-up">
      <div className="mb-6 flex items-center gap-2.5">
        <div className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-linear-to-br from-notia-accent to-notia-green text-[14px] font-black text-white shadow-[0_2px_8px_rgba(0,122,255,0.3)]">
          N
        </div>
        <span className="text-[18px] font-extrabold tracking-[-0.6px] text-notia-text">Notia</span>
      </div>

      <h1 className="text-[24px] font-extrabold tracking-[-0.8px] text-notia-text">{t("title")}</h1>
      <p className="mt-1 text-[13px] text-notia-text-secondary">{t("subtitle")}</p>

      <form
        className="mt-6 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();

          if (password !== passwordConfirmation) {
            toast.error(t("passwordMismatch"));
            return;
          }

          setLoading(true);
          try {
            await signUp.email(
              {
                email,
                password,
                name: `${firstName} ${lastName}`.trim(),
                image: "",
              },
              {
                onSuccess: () => {
                  toast.success(t("processado"));
                  router.push("/dashboard");
                },
                onError: (ctx) => { toast.error(ctx.error.message || t("error")); },
              }
            );
          } finally {
            setLoading(false);
          }
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="first-name" className="text-[12px] font-bold uppercase tracking-[0.5px] text-notia-text-muted">{t("firstNameLabel")}</label>
            <input id="first-name" placeholder={t("firstNamePlaceholder")} required value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={loading} className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="last-name" className="text-[12px] font-bold uppercase tracking-[0.5px] text-notia-text-muted">{t("lastNameLabel")}</label>
            <input id="last-name" placeholder={t("lastNamePlaceholder")} required value={lastName} onChange={(e) => setLastName(e.target.value)} disabled={loading} className={inputClass} />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="email" className="text-[12px] font-bold uppercase tracking-[0.5px] text-notia-text-muted">{t("emailLabel")}</label>
          <input id="email" type="email" placeholder={t("emailPlaceholder")} required value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} className={inputClass} />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="text-[12px] font-bold uppercase tracking-[0.5px] text-notia-text-muted">{t("passwordLabel")}</label>
          <input id="password" type="password" placeholder={t("passwordPlaceholder")} autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} className={inputClass} />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password_confirmation" className="text-[12px] font-bold uppercase tracking-[0.5px] text-notia-text-muted">{t("confirmPasswordLabel")}</label>
          <input id="password_confirmation" type="password" placeholder={t("confirmPasswordPlaceholder")} autoComplete="new-password" required value={passwordConfirmation} onChange={(e) => setPasswordConfirmation(e.target.value)} disabled={loading} className={inputClass} />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-[12px] bg-notia-accent px-4 py-3 text-[14px] font-bold text-white shadow-[0_3px_12px_rgba(0,122,255,0.32)] transition hover:-translate-y-0.5 hover:shadow-[0_5px_20px_rgba(0,122,255,0.44)] active:translate-y-0 disabled:opacity-60"
        >
          {loading ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            t("submit")
          )}
        </button>
      </form>

      <p className="mt-5 text-center text-[13px] text-notia-text-muted">
        {t("hasAccount")}{" "}
        <Link href="/sign-in" className="font-semibold text-notia-accent hover:underline">
          {t("signIn")}
        </Link>
      </p>
    </div>
  );
}
