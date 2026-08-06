"use client";
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Users, ClipboardList, HelpCircle, BarChart3, Settings, Laptop, LogOut, Building2, FileText, Clock, CalendarDays, Megaphone, GraduationCap, Package, FolderOpen, BookOpen, CalendarCheck, Trophy, Bell } from 'lucide-react';

interface SidebarProps {
  role: string;
  companyName?: string;
  onClose?: () => void;
}

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'hr', 'manager', 'employee'] },
  { href: '/employees', label: 'Employees', icon: Users, roles: ['admin', 'hr'] },
  { href: '/onboarding', label: 'Onboarding', icon: ClipboardList, roles: ['employee', 'manager'] },
  { href: '/attendance', label: 'Attendance', icon: Clock, roles: ['admin', 'hr', 'employee', 'manager'] },
  { href: '/leaves', label: 'Leave', icon: CalendarDays, roles: ['admin', 'hr', 'employee', 'manager'] },
  { href: '/announcements', label: 'Announcements', icon: Megaphone, roles: ['admin', 'hr', 'employee', 'manager'] },
  { href: '/training', label: 'Training', icon: GraduationCap, roles: ['admin', 'hr', 'employee', 'manager'] },
  { href: '/assets', label: 'Assets', icon: Package, roles: ['admin', 'hr', 'employee', 'manager'] },
  { href: '/documents', label: 'Documents', icon: FolderOpen, roles: ['admin', 'hr', 'employee', 'manager'] },
  { href: '/directory', label: 'Directory', icon: BookOpen, roles: ['admin', 'hr', 'employee', 'manager'] },
  { href: '/calendar', label: 'Calendar', icon: CalendarCheck, roles: ['admin', 'hr', 'employee', 'manager'] },
  { href: '/rewards', label: 'Rewards', icon: Trophy, roles: ['admin', 'hr', 'employee', 'manager'] },
  { href: '/notifications', label: 'Notifications', icon: Bell, roles: ['admin', 'hr', 'employee', 'manager'] },
  { href: '/requests', label: 'Requests', icon: HelpCircle, roles: ['admin', 'hr', 'employee', 'manager'] },
  { href: '/analytics', label: 'Analytics', icon: BarChart3, roles: ['admin', 'hr'] },
  { href: '/assistant', label: 'Ask AI', icon: Laptop, roles: ['employee', 'manager'] },
  { href: '/policies', label: 'Policies', icon: FileText, roles: ['admin', 'hr'] },
  { href: '/company', label: 'Company', icon: Building2, roles: ['admin'] },
  { href: '/settings', label: 'Settings', icon: Settings, roles: ['admin', 'hr', 'manager', 'employee'] },
];

export function Sidebar({ role, companyName, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const filtered = navItems.filter(item => item.roles.includes(role));

  const handleSignOut = async () => {
    try { await fetch("/api/auth", { method: "DELETE" }); } catch {}
    router.push("/login");
  };

  return (
    <div className='flex h-full flex-col bg-indigo-950 text-white'>
      <div className='flex h-16 items-center gap-2 px-6 border-b border-indigo-800'>
        <div className='h-8 w-8 rounded-lg bg-indigo-500 flex items-center justify-center text-sm font-bold'>O</div>
        <div>
          <p className='text-sm font-semibold'>OnboardAI</p>
          <p className='text-xs text-indigo-300'>{companyName || 'Employee Onboarding'}</p>
        </div>
      </div>
      <nav className='flex-1 space-y-1 p-4 overflow-y-auto'>
        {filtered.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-indigo-800 text-white'
                  : 'text-indigo-200 hover:bg-indigo-800/50 hover:text-white'
              )}
            >
              <Icon className='h-5 w-5 flex-shrink-0' />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className='p-4 border-t border-indigo-800'>
        <button onClick={handleSignOut} className='flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-indigo-200 hover:bg-indigo-800/50 hover:text-white transition-colors'>
          <LogOut className='h-5 w-5 flex-shrink-0' />
          Sign Out
        </button>
      </div>
    </div>
  );
}
