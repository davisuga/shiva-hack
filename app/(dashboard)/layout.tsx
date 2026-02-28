import { requireAuth } from "@/lib/auth-server";
import { auth } from "@/lib/auth";
import { Receipt, LogOut, Home, BarChart3, Settings, Upload } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-blue-600 to-purple-600 p-2 rounded-lg">
                <Receipt className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">Notia</h1>
            </div>

            <nav className="hidden md:flex items-center gap-6">
              <Link
                href="/dashboard"
                className="flex items-center gap-2 text-gray-700 hover:text-gray-900 transition-colors"
              >
                <Home className="w-4 h-4" />
                Dashboard
              </Link>
              <Link
                href="/dashboard/analytics"
                className="flex items-center gap-2 text-gray-700 hover:text-gray-900 transition-colors"
              >
                <BarChart3 className="w-4 h-4" />
                Analytics
              </Link>
              <Link
                href="/dashboard/upload"
                className="flex items-center gap-2 text-gray-700 hover:text-gray-900 transition-colors"
              >
                <Upload className="w-4 h-4" />
                Upload
              </Link>
              <Link
                href="/dashboard/settings"
                className="flex items-center gap-2 text-gray-700 hover:text-gray-900 transition-colors"
              >
                <Settings className="w-4 h-4" />
                Settings
              </Link>
            </nav>

            <div className="flex items-center gap-4">
              <div className="hidden sm:block">
                <div className="text-sm text-gray-600">
                  {session.user.name || session.user.email}
                </div>
              </div>
              <SignOutButton />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}

function SignOutButton() {
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
      <Button variant="outline" size="sm" type="submit">
        <LogOut className="w-4 h-4 mr-2" />
        Sign Out
      </Button>
    </form>
  );
}
