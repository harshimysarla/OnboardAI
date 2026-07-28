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
            <Link href="/login" className="rounded-xl border border-indigo-400 px-8 py-3.5 text-sm font-semibold text-white hover:bg-indigo-800/50 transition-colors">
              Sign In
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