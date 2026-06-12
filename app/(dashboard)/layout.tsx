import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import SessionProvider from "@/components/providers/session-provider";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <SessionProvider session={session}>
      <div className="flex h-full min-h-screen">
        <Sidebar />
        <main className="flex-1 ml-60 bg-[#F8F9FA] min-h-screen">
          {children}
        </main>
      </div>
    </SessionProvider>
  );
}
