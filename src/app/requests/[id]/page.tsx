"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { LoadingSpinner } from "@/components/ui/loading";
import { EmptyState } from "@/components/ui/empty-state";
import { getStatusColor, getPriorityColor, formatDate } from "@/lib/utils";
import { SupportRequest } from "@/types";
import { ArrowLeft, HelpCircle, Calendar, User, Building2, AlertTriangle } from "lucide-react";
import { useUser } from "@/lib/use-user";

export default function RequestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useUser();
  const [request, setRequest] = useState<SupportRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState("");

  const requestId = params.id as string;

  const loadRequest = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    setError("");
    try {
      const res = await fetch("/api/requests");
      if (!res.ok) throw new Error("Failed to load requests");
      const all: SupportRequest[] = await res.json();
      const found = Array.isArray(all) ? all.find((r) => r.id === requestId) : undefined;
      if (!found) {
        setNotFound(true);
        return;
      }
      setRequest(found);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load request");
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    loadRequest(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [loadRequest]);

  const handleStatusChange = async (newStatus: string) => {
    if (!request || updating) return;
    setUpdating(true);
    setUpdateError("");
    try {
      const res = await fetch("/api/requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: request.id, status: newStatus }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update status");
      }
      setRequest({ ...request, status: newStatus as SupportRequest["status"] });
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return <AppLayout><LoadingSpinner size="lg" /></AppLayout>;

  const isAdmin = user?.role === "admin" || user?.role === "hr";

  return (
    <AppLayout>
      <div className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/requests")}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
      </div>

      {notFound ? (
        <EmptyState
          icon={<HelpCircle className="h-12 w-12" />}
          title="Request not found"
          description="This support request does not exist or you don't have access to it."
        />
      ) : error ? (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="mb-4 flex items-center justify-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" /> {error}
            </p>
            <Button variant="outline" onClick={loadRequest}>Retry</Button>
          </CardContent>
        </Card>
      ) : request ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex flex-wrap items-center gap-3">
                <CardTitle>{request.type}</CardTitle>
                <Badge variant="info">{request.category}</Badge>
                <span className={"inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium " + getPriorityColor(request.priority)}>
                  {request.priority} priority
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
                <span className="inline-flex items-center gap-2">
                  <User className="h-3.5 w-3.5 text-gray-500" />
                  <span className="text-gray-500">Requester</span>
                  <span className="font-medium text-gray-900">{request.employee_name || "—"}</span>
                </span>
                <span className="inline-flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 text-gray-500" />
                  <span className="text-gray-500">Department</span>
                  <span className="font-medium text-gray-900">{request.department || "—"}</span>
                </span>
                <span className="inline-flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-gray-500" />
                  <span className="text-gray-500">Created</span>
                  <span className="font-medium text-gray-900">{formatDate(request.created_at)}</span>
                </span>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-medium text-gray-700">Description</h3>
                <p className="whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800">
                  {request.description || "No description provided."}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <span className={"inline-flex rounded-full px-3 py-1 text-sm font-medium " + getStatusColor(request.status)}>
                  {request.status}
                </span>
              </div>
              {isAdmin ? (
                <>
                  <Select
                    label="Update status"
                    value={request.status}
                    disabled={updating}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    options={[
                      { value: "Open", label: "Open" },
                      { value: "In Progress", label: "In Progress" },
                      { value: "Resolved", label: "Resolved" },
                    ]}
                  />
                  {updateError && <p className="text-sm text-red-600">{updateError}</p>}
                  <p className="text-xs text-gray-500">
                    Updated {formatDate(request.updated_at)}
                  </p>
                </>
              ) : (
                <p className="text-xs text-gray-500">
                  Your HR team will respond to this request. Updated {formatDate(request.updated_at)}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </AppLayout>
  );
}
