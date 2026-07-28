import os

BASE = r"C:\wse\OnboardAI"

def write_file(path, content):
    full = os.path.join(BASE, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Written: {path}")

# === Fix utils.ts ===
write_file("src/lib/utils.ts", """
import { RiskLevel } from "@/types";

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function getRiskColor(level: RiskLevel): string {
  switch (level) {
    case "green": return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "yellow": return "bg-amber-100 text-amber-800 border-amber-200";
    case "red": return "bg-red-100 text-red-800 border-red-200";
  }
}

export function getRiskDot(level: RiskLevel): string {
  switch (level) {
    case "green": return "bg-emerald-500";
    case "yellow": return "bg-amber-500";
    case "red": return "bg-red-500";
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "Open": return "bg-blue-100 text-blue-800 border-blue-200";
    case "In Progress": return "bg-amber-100 text-amber-800 border-amber-200";
    case "Resolved": return "bg-emerald-100 text-emerald-800 border-emerald-200";
    default: return "bg-gray-100 text-gray-800 border-gray-200";
  }
}

export function getPriorityColor(priority: string): string {
  switch (priority) {
    case "Low": return "bg-gray-100 text-gray-600";
    case "Medium": return "bg-blue-100 text-blue-700";
    case "High": return "bg-orange-100 text-orange-700";
    case "Urgent": return "bg-red-100 text-red-700";
    default: return "bg-gray-100 text-gray-600";
  }
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });
}

export function formatDateTime(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function getDaysSince(date: string): number {
  return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
}

export function isOverdue(dueDate: string): boolean {
  return new Date(dueDate) < new Date();
}
""".strip())

# === Fix empty-state.tsx ===
write_file("src/components/ui/empty-state.tsx", """
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon ? (
        <div className="mb-4 text-gray-400">{icon}</div>
      ) : (
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-3xl text-gray-400">
          -
        </div>
      )}
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-gray-500">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
""".strip())

# === Fix kpi-card.tsx ===
write_file("src/components/dashboard/kpi-card.tsx", """
interface KpiCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: { value: string; positive: boolean };
  color?: string;
}

export function KpiCard({ title, value, icon, trend, color = "indigo" }: KpiCardProps) {
  const colors: Record<string, string> = {
    indigo: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    amber: "bg-amber-50 text-amber-700 ring-amber-600/20",
    red: "bg-red-50 text-red-700 ring-red-600/20",
    blue: "bg-blue-50 text-blue-700 ring-blue-600/20",
  };
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
          {trend && (
            <p className={"mt-1 text-sm " + (trend.positive ? "text-emerald-600" : "text-red-600")}>
              {trend.value}
            </p>
          )}
        </div>
        <div className={"rounded-lg p-3 ring-1 ring-inset " + (colors[color] || colors.indigo)}>
          {icon}
        </div>
      </div>
    </div>
  );
}
""".strip())

print("All fixes done")