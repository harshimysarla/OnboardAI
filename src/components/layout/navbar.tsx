"use client";
import { Menu, Bell, User } from "lucide-react";

export function Navbar({ onMenuClick, user }: { onMenuClick: () => void; user: { name: string; role: string } }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-white px-6 shadow-sm">
      <button onClick={onMenuClick} className="lg:hidden rounded-lg p-2 text-gray-500 hover:bg-gray-100">
        <Menu className="h-5 w-5" />
      </button>
      <div className="flex-1" />
      <button className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100">
        <Bell className="h-5 w-5" />
        <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
      </button>
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
