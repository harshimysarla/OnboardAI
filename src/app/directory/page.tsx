"use client";

import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";
import { Users, Search } from "lucide-react";

interface Person {
  id: string;
  full_name: string;
  email: string;
  job_title: string;
  department: string;
  manager: string;
  joining_date: string;
}

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
  "bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500",
  "bg-sky-500", "bg-violet-500", "bg-teal-500", "bg-fuchsia-500",
];

function colorFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export default function DirectoryPage() {
  const [loading, setLoading] = useState(true);
  const [people, setPeople] = useState<Person[]>([]);
  const [q, setQ] = useState("");
  const [deferred, setDeferred] = useState("");

  const load = useCallback(async () => {
    const url = deferred ? `/api/directory?q=${encodeURIComponent(deferred)}` : "/api/directory";
    const res = await fetch(url);
    if (!res.ok) return;
    const data = await res.json();
    setPeople(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [deferred]);

  useEffect(() => {
    load(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [load]);

  useEffect(() => {
    const t = setTimeout(() => setDeferred(q), 350);
    return () => clearTimeout(t);
  }, [q]);

  if (loading) return <AppLayout><LoadingSpinner size="lg" /></AppLayout>;

  return (
    <AppLayout>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Company Directory</h1>
          <p className="mt-1 text-sm text-gray-500">{people.length} people in your company</p>
        </div>
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input className="pl-9" placeholder="Search name, team, title..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {people.length === 0 ? (
        <Card><CardContent className="p-0">
          <EmptyState icon={<Users className="h-12 w-12" />} title="No people found" description={q ? "Try a different search term." : "Your team will appear here."} />
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {people.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex items-start gap-4 p-5">
                <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${colorFor(p.full_name)}`}>
                  {initials(p.full_name)}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-gray-900">{p.full_name}</p>
                  <p className="truncate text-sm text-gray-500">{p.job_title || "Team member"}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {p.department && <Badge>{p.department}</Badge>}
                    {p.manager && <Badge variant="info">Reports to {p.manager}</Badge>}
                  </div>
                  <p className="mt-2 truncate text-xs text-gray-400">{p.email}</p>
                  {p.joining_date && <p className="mt-1 text-xs text-gray-400">Joined {formatDate(p.joining_date)}</p>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppLayout>
  );
}