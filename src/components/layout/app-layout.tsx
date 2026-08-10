"use client";

import { Sidebar } from "./sidebar";
import { Navbar } from "./navbar";
import { LoadingSpinner } from "@/components/ui/loading";
import { useUser } from "@/lib/use-user";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
      return;
    }
    if (!loading && user?.must_change_password && pathname !== "/setup") {
      router.replace("/setup");
    }
  }, [loading, user, router, pathname]);

  if (loading || !user) return <LoadingSpinner size="lg" />;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <div className="hidden lg:flex">
        <Sidebar role={user.role} companyName={user.company_name} />
      </div>
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <Sidebar role={user.role} companyName={user.company_name} onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Navbar user={user} onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
