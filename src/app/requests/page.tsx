"use client";

import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { getStatusColor, getPriorityColor, formatDate } from "@/lib/utils";
import { SupportRequest } from "@/types";
import { HelpCircle } from "lucide-react";
import Link from "next/link";

export default function RequestsPage() {
  const [user, setUser] = useState<any>(null);
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("onboardai_user");
    if (stored) try {
      setUser(JSON.parse(stored));
    } catch {}
    loadRequests();
  }, []);

  const loadRequests = async () => {
    setLoading(true);
    const res = await fetch("/api/requests");
    const data = await res.json();
    setRequests(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    await fetch("/api/requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: newStatus }),
    });
    await loadRequests();
  };

  if (loading) return <AppLayout><LoadingSpinner size="lg" /></AppLayout>;

  const isAdmin = user?.role === "admin";
  const filtered = isAdmin ? requests : requests.filter(r => r.employee_id === user?.id);

  const statusFiltered = filtered.filter(r => {
    if (statusFilter && r.status !== statusFilter) return false;
    if (priorityFilter && r.priority !== priorityFilter) return false;
    if (categoryFilter && r.category !== categoryFilter) return false;
    return true;
  });

  const statuses = [...new Set(requests.map(r => r.status))];
  const priorities = [...new Set(requests.map(r => r.priority))];
  const categories = [...new Set(requests.map(r => r.category))];

  const openCount = filtered.filter(r => r.status === "Open").length;
  const inProgressCount = filtered.filter(r => r.status === "In Progress").length;
  const resolvedCount = filtered.filter(r => r.status === "Resolved").length;

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          {isAdmin ? "Support Requests" : "My Requests"}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {isAdmin ? "Manage HR and IT support requests" : "Track your support requests"}
        </p>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-gray-500">Open</p>
            <p className="text-2xl font-bold text-blue-600">{openCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-gray-500">In Progress</p>
            <p className="text-2xl font-bold text-amber-600">{inProgressCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-gray-500">Resolved</p>
            <p className="text-2xl font-bold text-emerald-600">{resolvedCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              options={[{ value: "", label: "All Statuses" }, ...statuses.map(s => ({ value: s, label: s }))]} />
            <Select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}
              options={[{ value: "", label: "All Priorities" }, ...priorities.map(p => ({ value: p, label: p }))]} />
            <Select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
              options={[{ value: "", label: "All Categories" }, ...categories.map(c => ({ value: c, label: c }))]} />
          </div>
        </CardContent>
      </Card>

      {statusFiltered.length === 0 ? (
        <EmptyState
          icon={<HelpCircle className="h-12 w-12" />}
          title="No support requests"
          description={isAdmin ? "No requests match your filters." : "You haven't created any support requests yet."}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <THead>
                <TR>
                  <TH>ID</TH>
                  {isAdmin && <TH>Employee</TH>}
                  <TH>Request</TH>
                  <TH>Category</TH>
                  <TH>Priority</TH>
                  <TH>Status</TH>
                  <TH>Created</TH>
                  {isAdmin && <TH>Action</TH>}
                </TR>
              </THead>
              <TBody>
                {statusFiltered.map(req => (
                  <TR key={req.id}>
                    <TD className="text-xs font-mono text-gray-500">{req.id}</TD>
                    {isAdmin && (
                      <TD>
                        <Link href={"/employees/" + req.employee_id} className="font-medium text-indigo-600 hover:text-indigo-800">
                          {req.employee_name}
                        </Link>
                      </TD>
                    )}
                    <TD>
                      <p className="font-medium text-gray-900">{req.type}</p>
                      <p className="text-xs text-gray-500 truncate max-w-[200px]">{req.description}</p>
                    </TD>
                    <TD><Badge variant="info">{req.category}</Badge></TD>
                    <TD>
                      <span className={"inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium " + getPriorityColor(req.priority)}>
                        {req.priority}
                      </span>
                    </TD>
                    <TD>
                      {isAdmin ? (
                        <select
                          value={req.status}
                          onChange={e => handleStatusChange(req.id, e.target.value)}
                          className={"rounded-full border px-2.5 py-0.5 text-xs font-medium " + getStatusColor(req.status)}
                        >
                          <option value="Open">Open</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Resolved">Resolved</option>
                        </select>
                      ) : (
                        <span className={"inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium " + getStatusColor(req.status)}>
                          {req.status}
                        </span>
                      )}
                    </TD>
                    <TD className="text-xs text-gray-500">{formatDate(req.created_at)}</TD>
                    {isAdmin && (
                      <TD>
                        <Link href={"/employees/" + req.employee_id}>
                          <Button variant="ghost" size="sm">View</Button>
                        </Link>
                      </TD>
                    )}
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </AppLayout>
  );
}
