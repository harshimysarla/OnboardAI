"use client";

import { Sidebar } from "./sidebar";
import { Navbar } from "./navbar";
import { LoadingSpinner } from "@/components/ui/loading";
import { useUser } from "@/lib/use-user";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  if (loading) return <LoadingSpinner size="lg" />;
  if (!user) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar role={user.role} companyName={user.company_name} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Navbar user={user} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
