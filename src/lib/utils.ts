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