"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { demoUsers } from "@/data/demo-data";
import { isSupabaseConfigured } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleDemoLogin = (role: "admin" | "employee") => {
    const user = role === "admin" ? demoUsers[0] : demoUsers[1];
    localStorage.setItem("onboardai_user", JSON.stringify({ name: user.full_name, role: user.role, email: user.email, id: user.employee_id }));
    router.push("/dashboard");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Try Supabase auth first
    if (isSupabaseConfigured) {
      try {
        const res = await fetch("/api/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        if (res.ok) {
          router.push("/dashboard");
          return;
        }
        const data = await res.json();
        setError(data.error || "Login failed");
        setLoading(false);
        return;
      } catch {
        // Fall through to demo login
      }
    }

    // Demo mode auth
    const user = demoUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (user) {
      localStorage.setItem("onboardai_user", JSON.stringify({ name: user.full_name, role: user.role, email: user.email, id: user.employee_id }));
      router.push("/dashboard");
    } else {
      setError("Demo user not found. Try: hr@onboardai.com");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-indigo-900 to-indigo-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500 text-lg font-bold text-white">O</div>
            <span className="text-xl font-bold text-white">OnboardAI</span>
          </Link>
        </div>
        <div className="rounded-2xl bg-white p-8 shadow-2xl">
          <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
          <p className="mt-1 text-sm text-gray-500">Sign in to your OnboardAI account</p>

          {isSupabaseConfigured && (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
              <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" className="w-full" loading={loading}>Sign In</Button>
            </form>
          )}

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-2 text-gray-500">
                  {isSupabaseConfigured ? "Demo Access" : "Demo Login"}
                </span>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button onClick={() => handleDemoLogin("admin")} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                HR Admin
              </button>
              <button onClick={() => handleDemoLogin("employee")} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                Employee
              </button>
            </div>
            <p className="mt-4 text-xs text-gray-400 text-center">
              {isSupabaseConfigured ? "Or use demo quick login below" : "Demo: hr@onboardai.com (HR) | rahul.sharma@onboardai.com (Employee)"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
