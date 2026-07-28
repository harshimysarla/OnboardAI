"use client";

import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { Shield, Bell, LogOut } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase";

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; role: string; email: string } | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("onboardai_user");
    if (stored) try { setUser(JSON.parse(stored)); } catch {}
  }, []);

  const handleSignOut = async () => {
    // Sign out from Supabase if configured
    if (isSupabaseConfigured) {
      try {
        await fetch("/api/auth", { method: "DELETE" });
      } catch {}
    }
    localStorage.removeItem("onboardai_user");
    router.push("/login");
  };

  if (!user) return null;

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">Manage your account and preferences</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100 text-xl font-bold text-indigo-700">
                {user.name.charAt(0)}
              </div>
              <div>
                <p className="font-medium text-gray-900">{user.name}</p>
                <p className="text-sm text-gray-500">{user.email}</p>
              </div>
            </div>
            <div className="rounded-lg bg-gray-50 p-3 text-sm">
              <span className="font-medium text-gray-700">Role: </span>
              <span className="capitalize text-gray-500">{user.role}</span>
            </div>
            {isSupabaseConfigured && (
              <p className="text-xs text-emerald-600">Connected to Supabase</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Preferences</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-gray-400" />
                <span className="text-sm text-gray-700">Email Notifications</span>
              </div>
              <div className="h-6 w-11 rounded-full bg-indigo-600 relative cursor-pointer">
                <div className="absolute right-1 top-1 h-4 w-4 rounded-full bg-white" />
              </div>
            </div>
            <p className="text-xs text-gray-400">Notification preferences coming soon.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Account</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 text-sm text-gray-700">
              <Shield className="h-5 w-5 text-gray-400" />
              {isSupabaseConfigured ? "Production Mode" : "Demo Mode"}
            </div>
            <p className="text-xs text-gray-400">
              {isSupabaseConfigured
                ? "Connected to Supabase. Data is persisted."
                : "No database configured. Data is stored in memory only."}
            </p>
            <Button variant="danger" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" /> Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
