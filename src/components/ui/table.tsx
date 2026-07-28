import { cn } from "@/lib/utils";

interface TProps { children: React.ReactNode; className?: string; }

export function Table({ children, className }: TProps) {
  return <table className={cn("min-w-full divide-y divide-gray-200", className)}>{children}</table>;
}

export function THead({ children, className }: TProps) {
  return <thead className={cn("bg-gray-50", className)}>{children}</thead>;
}

export function TBody({ children, className }: TProps) {
  return <tbody className={cn("divide-y divide-gray-200 bg-white", className)}>{children}</tbody>;
}

export function TR({ children, className }: TProps) {
  return <tr className={cn("hover:bg-gray-50 transition-colors", className)}>{children}</tr>;
}

export function TH({ children, className }: TProps) {
  return <th className={cn("px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", className)}>{children}</th>;
}

export function TD({ children, className }: TProps) {
  return <td className={cn("px-6 py-4 whitespace-nowrap text-sm text-gray-900", className)}>{children}</td>;
}