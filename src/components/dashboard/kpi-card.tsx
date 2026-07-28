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