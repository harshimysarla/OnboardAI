"use client";

import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useUser } from "@/lib/use-user";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Trash2, Cake, Gift, X } from "lucide-react";

interface CalEvent {
  id: string;
  title: string;
  type: string;
  date: string;
  all_day: boolean;
  time: string;
  location: string;
  notes: string;
  recurring: boolean;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const TYPE_META: Record<string, { label: string; variant: "default" | "success" | "warning" | "danger" | "info" }> = {
  holiday: { label: "Holiday", variant: "danger" },
  event: { label: "Event", variant: "info" },
  birthday: { label: "Birthday", variant: "success" },
  anniversary: { label: "Anniversary", variant: "warning" },
  other: { label: "Other", variant: "default" },
};

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function CalendarPage() {
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const now = new Date();
  const [ym, setYm] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", type: "event", date: "", time: "", location: "", notes: "", recurring: false });

  const isStaff = user?.role === "admin" || user?.role === "hr";

  const load = useCallback(async () => {
    const res = await fetch(`/api/calendar?month=${ym}`);
    if (!res.ok) return;
    const data = await res.json();
    setEvents(data.events || []);
    setLoading(false);
  }, [ym]);

  useEffect(() => {
    load(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [load]);

  const [y, m] = ym.split("-").map(Number);
  const firstDay = new Date(y, m - 1, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(y, m, 0).getDate();
  const days: (Date | null)[] = [
    ...Array.from({ length: startOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(y, m - 1, i + 1)),
  ];
  while (days.length % 7 !== 0) days.push(null);

  const byDay = new Map<string, CalEvent[]>();
  for (const ev of events) {
    const k = dayKey(new Date(ev.date));
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push(ev);
  }

  const prevMonth = () => setYm(y === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`);
  const nextMonth = () => setYm(y === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`);

  const create = async () => {
    if (!form.title.trim() || !form.date) {
      setMessage("Title and date are required");
      return;
    }
    setBusy(true);
    setMessage("");
    const res = await fetch("/api/calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, date: `${form.date}T00:00:00Z` }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage(data.error || "Unable to create event");
      return;
    }
    setForm({ title: "", type: "event", date: "", time: "", location: "", notes: "", recurring: false });
    setShowForm(false);
    load();
  };

  const remove = async (id: string) => {
    if (!id.startsWith("cal-")) return;
    setBusy(true);
    await fetch(`/api/calendar?id=${id}`, { method: "DELETE" });
    setBusy(false);
    load();
  };

  const upcoming = events.filter((e) => new Date(e.date) >= new Date(y, m - 1, 1)).slice(0, 12);

  if (loading) return <AppLayout><LoadingSpinner size="lg" /></AppLayout>;

  return (
    <AppLayout>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Company Calendar</h1>
          <p className="mt-1 text-sm text-gray-500">Holidays, events, birthdays and anniversaries</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-lg border border-gray-300 bg-white">
            <button onClick={prevMonth} className="p-2 text-gray-500 hover:text-gray-900"><ChevronLeft className="h-4 w-4" /></button>
            <span className="min-w-[140px] text-center text-sm font-medium">{MONTHS[m - 1]} {y}</span>
            <button onClick={nextMonth} className="p-2 text-gray-500 hover:text-gray-900"><ChevronRight className="h-4 w-4" /></button>
          </div>
          {isStaff && <Button onClick={() => setShowForm(!showForm)}><Plus className="mr-2 h-4 w-4" />Add Event</Button>}
        </div>
      </div>

      {message && <p className="mb-4 text-sm text-red-600">{message}</p>}

      {showForm && isStaff && (
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Add Event</CardTitle>
              <button onClick={() => setShowForm(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Independence Day" />
              <div>
                <Select label="Type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                  options={Object.entries(TYPE_META).map(([k, v]) => ({ value: k, label: v.label }))} />
              </div>
              <Input type="date" label="Date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              <Input label="Time (if not all day)" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} placeholder="e.g. 14:00" />
              <Input label="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              <div className="flex items-end gap-4 pb-1">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={form.recurring} onChange={(e) => setForm({ ...form, recurring: e.target.checked })} className="h-4 w-4 rounded border-gray-300 text-indigo-600" />
                  Repeats yearly
                </label>
              </div>
            </div>
            <Input label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <Button loading={busy} onClick={create}>Save Event</Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg bg-gray-200 text-center">
                {WEEKDAYS.map((d) => (
                  <div key={d} className="bg-gray-50 py-2 text-xs font-medium text-gray-500">{d}</div>
                ))}
                {days.map((d, i) =>
                  d === null ? (
                    <div key={`x-${i}`} className="min-h-[84px] bg-white" />
                  ) : (
                    <div key={i} className="min-h-[84px] bg-white p-1.5 text-left align-top">
                      <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${dayKey(d) === dayKey(new Date()) ? "bg-indigo-600 font-semibold text-white" : "text-gray-700"}`}>
                        {d.getDate()}
                      </span>
                      <div className="mt-1 space-y-1">
                        {(byDay.get(dayKey(d)) || []).map((ev, j) => (
                          <div key={`${ev.id}-${j}`} className="group relative">
                            <div className={`truncate rounded px-1 py-0.5 text-[10px] leading-tight ${typeColor(ev.type)}`}>
                              {ev.title}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-indigo-500" />
                <CardTitle>This Month</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {upcoming.length === 0 ? (
                <div className="py-8">
                  <EmptyState icon={<CalendarDays className="h-10 w-10" />} title="Nothing scheduled" description="No events this month." />
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {upcoming.map((ev) => (
                    <div key={`${ev.id}-${ev.title}`} className="flex items-center justify-between gap-3 px-5 py-3">
                      <div className="flex items-center gap-3">
                        {ev.type === "birthday" ? <Cake className="h-4 w-4 flex-shrink-0 text-rose-500" />
                          : ev.type === "anniversary" ? <Gift className="h-4 w-4 flex-shrink-0 text-amber-500" />
                          : <CalendarDays className="h-4 w-4 flex-shrink-0 text-indigo-500" />}
                        <div>
                          <p className="text-sm font-medium text-gray-900">{ev.title}</p>
                          <p className="text-xs text-gray-400">
                            {new Date(ev.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                            {ev.time ? ` · ${ev.time}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={TYPE_META[ev.type]?.variant || "default"}>{TYPE_META[ev.type]?.label || ev.type}</Badge>
                        {isStaff && ev.id.startsWith("cal-") && (
                          <Button size="sm" variant="ghost" loading={busy} onClick={() => remove(ev.id)}><Trash2 className="h-4 w-4" /></Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );

  function typeColor(type: string): string {
    switch (type) {
      case "holiday": return "bg-red-100 text-red-700";
      case "event": return "bg-blue-100 text-blue-700";
      case "birthday": return "bg-rose-100 text-rose-700";
      case "anniversary": return "bg-amber-100 text-amber-700";
      default: return "bg-gray-100 text-gray-700";
    }
  }
}