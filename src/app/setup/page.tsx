"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { LoadingSpinner } from "@/components/ui/loading";
import { useUser } from "@/lib/use-user";
import { CheckCircle, Lock, UserCircle, FileText } from "lucide-react";

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "zh", label: "Chinese" },
  { value: "ja", label: "Japanese" },
  { value: "pt", label: "Portuguese" },
];

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern (UTC-5)" },
  { value: "America/Chicago", label: "Central (UTC-6)" },
  { value: "America/Denver", label: "Mountain (UTC-7)" },
  { value: "America/Los_Angeles", label: "Pacific (UTC-8)" },
  { value: "Europe/London", label: "London (UTC+0)" },
  { value: "Europe/Paris", label: "Paris (UTC+1)" },
  { value: "Asia/Kolkata", label: "India (UTC+5:30)" },
  { value: "Asia/Shanghai", label: "China (UTC+8)" },
  { value: "Asia/Tokyo", label: "Tokyo (UTC+9)" },
  { value: "Asia/Dubai", label: "Dubai (UTC+4)" },
  { value: "Pacific/Auckland", label: "New Zealand (UTC+12)" },
  { value: "UTC", label: "UTC" },
];

export default function SetupPage() {
  const { user, loading } = useUser();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Step 1: password
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Step 2: profile
  const [phone, setPhone] = useState("");
  const [language, setLanguage] = useState("en");
  const [timezone, setTimezone] = useState("");

  // Step 3: policies
  const [policies, setPolicies] = useState<{ id: string; title: string; content: string }[]>([]);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!loading && user && !user.must_change_password) {
      router.replace("/dashboard");
    }
  }, [loading, user, router]);

  useEffect(() => {
    fetch("/api/policies")
      .then((r) => r.json())
      .then((data) => setPolicies(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const handlePassword = async () => {
    setError("");
    if (newPassword.length < 6) { setError("Password must be at least 6 characters"); return; }
    if (newPassword !== confirmPassword) { setError("Passwords do not match"); return; }
    setBusy(true);
    const res = await fetch("/api/auth/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ new_password: newPassword }),
    });
    setBusy(false);
    if (!res.ok) { setError("Failed to update password"); return; }
    setStep(2);
  };

  const handleProfile = async () => {
    setError("");
    setBusy(true);
    const res = await fetch("/api/auth/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, language, timezone }),
    });
    setBusy(false);
    if (!res.ok) { setError("Failed to save profile"); return; }
    setStep(3);
  };

  const handleAcceptPolicies = async () => {
    setError("");
    setBusy(true);
    const res = await fetch("/api/auth/accept-policies", { method: "POST" });
    setBusy(false);
    if (!res.ok) { setError("Failed to accept policies"); return; }
    router.replace("/dashboard");
  };

  if (loading) return <LoadingSpinner size="lg" />;
  if (!user) return null;

  const steps = [
    { num: 1, label: "New Password", icon: Lock },
    { num: 2, label: "Profile", icon: UserCircle },
    { num: 3, label: "Policies", icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-indigo-900 to-indigo-800 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500 text-lg font-bold text-white">O</div>
            <span className="text-xl font-bold text-white">OnboardAI</span>
          </div>
          <h1 className="mt-4 text-2xl font-bold text-white">Welcome, {user.name}!</h1>
          <p className="mt-1 text-sm text-indigo-200">Let&apos;s get you set up</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-3 mb-8">
          {steps.map((s, i) => (
            <div key={s.num} className="flex items-center gap-3">
              <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                i + 1 === step ? "bg-indigo-500 text-white" : i + 1 < step ? "bg-emerald-500/80 text-white" : "bg-white/10 text-white/60"
              }`}>
                {i + 1 < step ? <CheckCircle className="h-3.5 w-3.5" /> : null}
                {s.label}
              </div>
              {i < 2 && <div className={`h-0.5 w-8 rounded ${i + 1 < step ? "bg-emerald-400" : "bg-white/20"}`} />}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="rounded-2xl bg-white p-8 shadow-2xl">
          {step === 1 && (
            <>
              <h2 className="text-xl font-bold text-gray-900">Set your password</h2>
              <p className="mt-1 text-sm text-gray-500">You are using a temporary password. Choose a new one.</p>
              <div className="mt-5 space-y-3">
                <Input label="New Password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 6 characters" />
                <Input label="Confirm Password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter password" />
              </div>
              {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
              <Button className="mt-5 w-full" onClick={handlePassword} loading={busy}>Continue</Button>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="text-xl font-bold text-gray-900">Complete your profile</h2>
              <p className="mt-1 text-sm text-gray-500">Add your details to help your team connect with you.</p>
              <div className="mt-5 space-y-3">
                <Input label="Phone number" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555-0000" />
                <Select label="Language" value={language} onChange={(e) => setLanguage(e.target.value)}
                  options={LANGUAGES} />
                <Select label="Timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)}
                  options={[{ value: "", label: "Select timezone" }, ...TIMEZONES]} />
              </div>
              {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
              <Button className="mt-5 w-full" onClick={handleProfile} loading={busy}>Continue</Button>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="text-xl font-bold text-gray-900">Review company policies</h2>
              <p className="mt-1 text-sm text-gray-500">Please accept the policies below to continue.</p>
              <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
                {policies.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">No policies configured. You can accept and proceed.</p>
                ) : (
                  policies.map((p) => (
                    <details key={p.id} className="group rounded-lg border border-gray-200 p-3">
                      <summary className="cursor-pointer text-sm font-medium text-gray-900 list-none select-none">{p.title}</summary>
                      <p className="mt-2 text-xs leading-relaxed text-gray-600 whitespace-pre-wrap">{p.content}</p>
                    </details>
                  ))
                )}
              </div>
              <label className="mt-4 flex items-start gap-2 cursor-pointer">
                <input type="checkbox" className="mt-0.5 h-4 w-4 rounded accent-indigo-600" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
                <span className="text-sm text-gray-700">I have read and agree to all company policies</span>
              </label>
              {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
              <Button className="mt-4 w-full" onClick={handleAcceptPolicies} loading={busy} disabled={!accepted}>
                Finish Setup
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}