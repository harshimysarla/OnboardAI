"use client";

import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { ScrollText, ShieldAlert } from "lucide-react";
import { useUser } from "@/lib/use-user";
import { formatDate } from "@/lib/utils";

interface ActivityLog {
  id: string;
  action: string;
  details: string;
  ip: string;
  created_at: string;
  employee_id?: {
    _id: string;
    full_name: string;
    email: string;
  };
}

export default function LogsPage() {
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<ActivityLog[]>([]);

  useEffect(() => {
    fetch("/api/logs?limit=100")
      .then((res) => res.json())
      .then((data) => {
        setLogs(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <AppLayout><LoadingSpinner size="lg" /></AppLayout>;

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Security Audit Logs</h1>
        <p className="mt-1 text-sm text-gray-500">Track sensitive actions and activities</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-red-500" />
            Activity Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <EmptyState icon={<ScrollText className="h-10 w-10" />} title="No audit logs" description="No sensitive actions have been recorded yet." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="border-b bg-gray-50 text-xs font-semibold uppercase text-gray-900">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Details</th>
                    <th className="px-4 py-3">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-4 py-3 text-gray-900">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        {log.employee_id ? (
                          <div>
                            <div className="font-medium text-gray-900">{log.employee_id.full_name}</div>
                            <div className="text-xs text-gray-500">{log.employee_id.email}</div>
                          </div>
                        ) : (
                          <span className="text-gray-400">System / Unknown</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge variant="default" className="uppercase font-mono text-xs">
                          {log.action}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span className="break-all">{log.details || "-"}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {log.ip || "N/A"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}
