"use client";
import { useState, useEffect } from "react";
import { Sidebar } from "./sidebar";
import { Navbar } from "./navbar";
import { LoadingSpinner } from "@/components/ui/loading";
import { isSupabaseConfigured } from "@/lib/supabase";

interface AppUser {
  name: string;
  role: string;
  email: string;
  id?: string;
  company_name?: string;
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      // Try Supabase auth first
      if (isSupabaseConfigured) {
        try {
          const res = await fetch("/api/auth");
          const data = await res.json();
          if (data.user) {
            setUser({
              name: data.user.full_name,
              role: data.user.role,
              email: data.user.email,
              id: data.user.employee_id,
              company_name: data.user.company_name,
            });
            setLoading(false);
            return;
          }
        } catch {}
      }

      // Fallback to demo localStorage auth
      const stored = localStorage.getItem("onboardai_user");
      if (stored) try {
        setUser(JSON.parse(stored));
      } catch {}
      setLoading(false);
    }
    loadUser();
  }, []);

  if (loading) return <LoadingSpinner size="lg" />;
  if (!user) return <div className="flex items-center justify-center h-screen"><p className="text-gray-500">Please log in</p></div>;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-200 lg:relative lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <Sidebar role={user.role} companyName={user.company_name} onClose={() => setSidebarOpen(false)} />
      </div>
      <div className="flex flex-1 flex-col overflow-hidden">
        <Navbar onMenuClick={() => setSidebarOpen(true)} user={user} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
