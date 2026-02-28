import { requireAuth } from "@/lib/auth-server";
import { auth } from "@/lib/auth";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { LogOut } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAuth();
  const t = await getTranslations("DashboardLayout");

  return (
    <div className="min-h-screen bg-notia-bg">
      <nav className="animate-fade-down sticky top-0 z-100 flex h-[62px] items-center justify-between px-7 backdrop-blur-2xl backdrop-saturate-200 bg-[rgba(242,242,247,0.85)] border-b border-[rgba(0,0,0,0.07)]">
        <div className="flex items-center gap-2.5">
          <div className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-linear-to-br from-notia-accent to-notia-green text-[14px] font-black text-white shadow-[0_2px_8px_rgba(0,122,255,0.3)]">
            N
          </div>
          <span className="text-[18px] font-extrabold tracking-[-0.6px] text-notia-text">
            Notia
          </span>
        </div>

        <div className="flex items-center gap-3">
          <LocaleSwitcher />
          <span className="hidden text-sm text-notia-text-secondary sm:block">
            {t("signedInAs")}: {session.user.name || session.user.email}
          </span>
          <SignOutButton label={t("signOut")} />
        </div>
      </nav>

      <main className="mx-auto max-w-[1080px] px-5 py-6 pb-16 animate-fade-up-delay">
        {children}
      </main>
    </div>
  );
}

function SignOutButton({ label }: { label: string }) {
  return (
    <form
      action={async () => {
        "use server";
        await auth.api.signOut({
          headers: await headers(),
        });
        redirect("/sign-in");
      }}
    >
      <button
        type="submit"
        className="flex items-center gap-1.5 rounded-full border border-[rgba(0,0,0,0.07)] bg-notia-surface px-3 py-1.5 text-xs font-semibold text-notia-text-secondary shadow-[0_1px_4px_rgba(0,0,0,0.07)] transition hover:shadow-[0_2px_10px_rgba(0,0,0,0.1)]"
      >
        <LogOut className="h-3.5 w-3.5" />
        {label}
      </button>
    </form>
  );
}
