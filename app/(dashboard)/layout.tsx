import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import SessionProvider from "@/components/providers/session-provider";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <SessionProvider session={session}>
      <div className="flex h-full min-h-screen">
        {/* Desktop sidebar */}
        <div className="hidden lg:block">
          <Sidebar />
        </div>
        {/* Mobile nav */}
        <MobileNav />
        {/* Main content — offset on desktop, full-width on mobile */}
        <main className="flex-1 lg:ml-60 bg-[#F8F9FA] min-h-screen">
          {children}
        </main>
      </div>
    </SessionProvider>
  );
}
