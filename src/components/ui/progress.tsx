import { cn } from "@/lib/utils";

interface ProgressProps {
  value: number;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function Progress({ value, className, size = "md" }: ProgressProps) {
  const heights = { sm: "h-1.5", md: "h-2.5", lg: "h-4" };
  const barColor = value >= 80 ? "bg-emerald-500" : value >= 50 ? "bg-blue-500" : value >= 25 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className={cn("w-full bg-gray-200 rounded-full", heights[size], className)}>
      <div className={cn("rounded-full transition-all duration-300", heights[size], barColor)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}