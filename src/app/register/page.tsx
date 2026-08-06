"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [accessCode, setAccessCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [registrationEnabled] = useState(
    () => process.env.NEXT_PUBLIC_ALLOW_REGISTRATION === "true"
  );

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(accessCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          email,
          password,
          company_name: companyName,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setAccessCode(data.access_code || "");
        return;
      }
      const data = await res.json();
      setError(data.error || "Registration failed");
    } catch {
      setError("Connection error. Please try again.");
    }
    setLoading(false);
  };

  if (accessCode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-indigo-900 to-indigo-800 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="inline-flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500 text-lg font-bold text-white">O</div>
              <span className="text-xl font-bold text-white">OnboardAI</span>
            </div>
          </div>
          <div className="rounded-2xl bg-white p-8 shadow-2xl">
            <h2 className="text-2xl font-bold text-gray-900">Workspace created!</h2>
            <p className="mt-1 text-sm text-gray-500">
              Share this Company Access Code with your team. Every employee needs it (along with their email and password) to sign in.
            </p>
            <div className="mt-6 flex items-center justify-between rounded-xl border-2 border-dashed border-indigo-300 bg-indigo-50 px-4 py-3">
              <span className="font-mono text-2xl font-bold tracking-widest text-indigo-700">{accessCode}</span>
              <Button type="button" variant="outline" size="sm" onClick={handleCopyCode}>
                {copied ? "Copied!" : "Copy"}
              </Button>
            </div>
            <Button type="button" className="mt-6 w-full" onClick={() => router.push("/dashboard")}>
              Go to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!registrationEnabled) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-indigo-900 to-indigo-800 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="rounded-2xl bg-white p-8 shadow-2xl">
            <h2 className="text-2xl font-bold text-gray-900">Registration disabled</h2>
            <p className="mt-2 text-sm text-gray-500">
              New account creation is turned off. Contact your administrator.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-500"
            >
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

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
          <h2 className="text-2xl font-bold text-gray-900">Create your account</h2>
          <p className="mt-1 text-sm text-gray-500">Set up your company and become its administrator</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <Input label="Full name" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" />
            <Input label="Company name" type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Acme Inc." />
            <Input label="Work email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
            <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full" loading={loading}>Create Account</Button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}