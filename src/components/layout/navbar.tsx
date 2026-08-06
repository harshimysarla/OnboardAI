"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, User } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

interface AppNotification {
  id: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
}

export function Navbar({ user }: { user: { name: string; role: string } }) {
  const router = useRouter();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch("/api/notifications");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setItems((data.notifications || []).slice(0, 8));
          setUnread(data.unread || 0);
        }
      } catch {}
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const markAll = async () => {
    await fetch("/api/notifications", { method: "PATCH" });
    setUnread(0);
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-white px-6 shadow-sm">
      <div className="flex-1" />
      <div className="relative" ref={panelRef}>
        <button
          onClick={() => setOpen(!open)}
          className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
        {open && (
          <div className="absolute right-0 top-12 w-96 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <p className="text-sm font-semibold text-gray-900">Notifications</p>
              {unread > 0 && (
                <button onClick={markAll} className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800">
                  <CheckCheck className="h-3.5 w-3.5" />Mark all read
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {items.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-gray-400">No notifications yet</p>
              ) : (
                items.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => setOpen(false)}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 ${n.read ? "" : "bg-indigo-50/50"}`}
                  >
                    <div className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${n.read ? "bg-gray-300" : "bg-indigo-500"}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">{n.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{n.body}</p>
                      <p className="mt-1 text-[11px] text-gray-400">{formatDateTime(n.created_at)}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
            <button
              onClick={() => { setOpen(false); router.push("/notifications"); }}
              className="w-full border-t px-4 py-2.5 text-center text-xs font-semibold text-indigo-600 hover:bg-gray-50"
            >
              View all notifications
            </button>
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 pl-4 border-l">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
          <User className="h-4 w-4" />
        </div>
        <div className="hidden sm:block">
          <p className="text-sm font-medium text-gray-900">{user.name}</p>
          <p className="text-xs text-gray-500 capitalize">{user.role}</p>
        </div>
      </div>
    </header>
  );
}
