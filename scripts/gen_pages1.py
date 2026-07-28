import os

BASE = r"C:\wse\OnboardAI"

def write_file(path, content):
    full = os.path.join(BASE, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Written: {path}")

# === Root layout ===
write_file("src/app/layout.tsx", """
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "OnboardAI - Employee Onboarding & Support",
  description: "Intelligent Employee Onboarding & Support Platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
""".strip())

# === Landing page ===
write_file("src/app/page.tsx", """
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-indigo-900 to-indigo-800">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <nav className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500 text-lg font-bold text-white">O</div>
            <span className="text-xl font-bold text-white">OnboardAI</span>
          </div>
          <div className="flex gap-4">
            <Link href="/login" className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors">
              Sign In
            </Link>
          </div>
        </nav>
        <main className="mt-24 text-center">
          <h1 className="text-5xl font-bold tracking-tight text-white sm:text-6xl">
            Intelligent Employee<br />Onboarding & Support
          </h1>
          <p className="mt-6 text-lg leading-8 text-indigo-200 max-w-2xl mx-auto">
            Automate onboarding, track progress, answer employee questions with AI,
            detect risks, and provide actionable insights for HR teams.
          </p>
          <div className="mt-10 flex items-center justify-center gap-6">
            <Link href="/login" className="rounded-xl bg-white px-8 py-3.5 text-sm font-semibold text-indigo-900 hover:bg-indigo-50 transition-colors shadow-lg">
              Get Started
            </Link>
            <Link href="/login?role=admin" className="rounded-xl border border-indigo-400 px-8 py-3.5 text-sm font-semibold text-white hover:bg-indigo-800/50 transition-colors">
              HR Demo Login
            </Link>
          </div>
          <div className="mt-20 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { title: "Smart Onboarding", desc: "Personalized onboarding plans based on role and department" },
              { title: "AI Assistant", desc: "Employee questions answered instantly using company policies" },
              { title: "Risk Detection", desc: "Identify at-risk employees before they fall behind" },
            ].map((f) => (
              <div key={f.title} className="rounded-xl border border-indigo-700/50 bg-indigo-800/30 p-6 text-left backdrop-blur">
                <h3 className="text-lg font-semibold text-white">{f.title}</h3>
                <p className="mt-2 text-sm text-indigo-200">{f.desc}</p>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
""".strip())

# === Login page ===
write_file("src/app/login/page.tsx", """
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { demoUsers } from "@/data/demo-data";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const handleDemoLogin = (role: "admin" | "employee") => {
    const user = role === "admin" ? demoUsers[0] : demoUsers[1];
    localStorage.setItem("onboardai_user", JSON.stringify({ name: user.full_name, role: user.role, email: user.email, id: user.employee_id }));
    router.push("/dashboard");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const user = demoUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (user) {
      localStorage.setItem("onboardai_user", JSON.stringify({ name: user.full_name, role: user.role, email: user.email, id: user.employee_id }));
      router.push("/dashboard");
    } else {
      setError("Demo user not found. Try: hr@onboardai.com, rahul.sharma@onboardai.com, priya.patel@onboardai.com, arjun.kumar@onboardai.com");
    }
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
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="hr@onboardai.com"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full">Sign In</Button>
          </form>
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
              <div className="relative flex justify-center text-xs"><span className="bg-white px-2 text-gray-500">Demo Access</span></div>
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
              Demo: hr@onboardai.com (HR) | rahul.sharma@onboardai.com (Employee)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
""".strip())

print("Base pages written")