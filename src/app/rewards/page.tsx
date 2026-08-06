"use client";

import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Trophy, Rocket, Clock, Flame, CheckCircle2, GraduationCap, FileText, Lock, Crown } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface BadgeDef {
  code: string;
  title: string;
  description: string;
  icon: string;
  points: number;
  earned: boolean;
  awarded_at?: string;
}

interface EarnedBadge extends BadgeDef {
  awarded_at: string;
}

interface LeaderEntry {
  id: string;
  full_name: string;
  points: number;
  badges: number;
  streak: number;
  department: string;
  is_me: boolean;
}

const ICONS: Record<string, typeof Trophy> = {
  rocket: Rocket,
  clock: Clock,
  flame: Flame,
  check: CheckCircle2,
  graduation: GraduationCap,
  file: FileText,
};

export default function RewardsPage() {
  const [loading, setLoading] = useState(true);
  const [points, setPoints] = useState(0);
  const [earned, setEarned] = useState<EarnedBadge[]>([]);
  const [catalog, setCatalog] = useState<BadgeDef[]>([]);
  const [rank, setRank] = useState(0);
  const [total, setTotal] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>([]);

  const load = useCallback(async () => {
    const res = await fetch("/api/gamification");
    if (!res.ok) return;
    const data = await res.json();
    setPoints(data.points || 0);
    setEarned(data.badges || []);
    setCatalog(data.catalog || []);
    setRank(data.rank || 0);
    setTotal(data.total || 0);
    setLeaderboard(data.leaderboard || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [load]);

  if (loading) return <AppLayout><LoadingSpinner size="lg" /></AppLayout>;

  const topThree = leaderboard.slice(0, 3);

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Rewards</h1>
        <p className="mt-1 text-sm text-gray-500">Earn points and badges by staying on track</p>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-gray-500">Points</p>
            <p className="mt-1 text-3xl font-bold text-indigo-600">{points}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-gray-500">Badges</p>
            <p className="mt-1 text-3xl font-bold text-indigo-600">{earned.length}/{catalog.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-gray-500">Company Rank</p>
            <p className="mt-1 text-3xl font-bold text-indigo-600">
              {rank > 0 ? `#${rank}` : "—"}
              {rank > 0 && <span className="text-base font-normal text-gray-400"> of {total}</span>}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-500" />
                <CardTitle>Badges</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {catalog.length === 0 ? (
                <div className="py-8">
                  <EmptyState icon={<Trophy className="h-10 w-10" />} title="No badges available" description="Check back later." />
                </div>
              ) : (
                <div className="grid gap-4 p-5 sm:grid-cols-2">
                  {catalog.map((b) => {
                    const mine = earned.find((e) => e.code === b.code);
                    const Icon = ICONS[b.icon] || Trophy;
                    return (
                      <div key={b.code} className={`flex items-start gap-3 rounded-xl border p-4 ${b.earned ? "border-amber-200 bg-amber-50/50" : "border-gray-200 bg-gray-50"}`}>
                        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${b.earned ? "bg-amber-100 text-amber-600" : "bg-gray-200 text-gray-400"}`}>
                          {b.earned ? <Icon className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900">{b.title}</p>
                          <p className="mt-0.5 text-xs text-gray-500">{b.description}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Badge>+{b.points} pts</Badge>
                            {mine && <Badge variant="success">Earned {formatDate(mine.awarded_at)}</Badge>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-indigo-500" />
                <CardTitle>Leaderboard</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {leaderboard.length === 0 ? (
                <div className="py-8">
                  <EmptyState icon={<Crown className="h-10 w-10" />} title="No contestants yet" description="Team members appear here as they earn points." />
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {topThree.map((e, i) => (
                    <div key={e.id} className={`flex items-center gap-4 px-5 py-3 ${e.is_me ? "bg-indigo-50/60" : ""}`}>
                      <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold ${i === 0 ? "bg-amber-100 text-amber-700" : i === 1 ? "bg-gray-200 text-gray-600" : "bg-orange-100 text-orange-700"}`}>
                        {i + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900">
                          {e.full_name} {e.is_me && <span className="text-xs text-indigo-500">(you)</span>}
                        </p>
                        <p className="text-xs text-gray-400">
                          {e.department || "General"} · {e.badges} badges{e.streak > 0 ? ` · ${e.streak}-day streak` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {i === 0 && <Badge variant="warning">Leader</Badge>}
                        <span className="font-semibold text-gray-900">{e.points}</span>
                      </div>
                    </div>
                  ))}
                  {leaderboard.slice(3).map((e, i) => (
                    <div key={e.id} className={`flex items-center gap-4 px-5 py-3 ${e.is_me ? "bg-indigo-50/60" : ""}`}>
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm text-gray-500">{i + 4}</div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900">
                          {e.full_name} {e.is_me && <span className="text-xs text-indigo-500">(you)</span>}
                        </p>
                        <p className="text-xs text-gray-400">{e.department || "General"}</p>
                      </div>
                      <span className="font-semibold text-gray-900">{e.points}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-indigo-500" />
              <CardTitle>How to earn</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-100">
              {[
                ["Complete an onboarding task", "+5 pts"],
                ["Daily attendance check-in", "+5 pts"],
                ["Pass a training quiz", "+10 pts"],
                ["Finish a training course", "+20 pts"],
                ["Earn each badge", "Bonus points"],
              ].map(([label, pts]) => (
                <div key={label} className="flex items-center justify-between px-5 py-3">
                  <p className="text-sm text-gray-700">{label}</p>
                  <Badge variant="info">{pts}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}