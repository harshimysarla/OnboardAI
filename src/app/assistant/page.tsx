"use client";

import { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading";
import { Badge } from "@/components/ui/badge";
import { ChatMessage, RequestIntent, RequestCategory, RequestPriority } from "@/types";

interface AssistantMessage extends ChatMessage {
  sources?: { title: string; content: string; section?: string; similarity?: number }[];
}
import { Send, Bot, User, AlertTriangle, CheckCircle, X } from "lucide-react";
import { useUser } from "@/lib/use-user";

export default function AssistantPage() {
  const { user } = useUser();
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingIntent, setPendingIntent] = useState<{
    intent: RequestIntent;
    details: { category: RequestCategory; type: string; description: string; priority: RequestPriority };
  } | null>(null);
  const [creating, setCreating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (!user || initialized.current) return;
    initialized.current = true;
    setMessages([{
      id: "welcome",
      role: "assistant",
      content: "Hello! I'm your OnboardAI assistant. I can help with company policies, onboarding tasks, and support requests. How can I help you today?",
      created_at: new Date().toISOString(),
    }]);
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !user || loading) return;

    const userMessage: ChatMessage = {
      id: "msg-" + Date.now(),
      role: "user",
      content: input,
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...messages, userMessage], employeeId: user.id, employeeName: user.name }),
      });

      if (!res.ok) throw new Error("Chat request failed");

      const data = await res.json();

      const sources = (data.sources || []) as AssistantMessage["sources"];
      const assistantMessage: AssistantMessage = {
        id: "msg-" + Date.now() + "-ai",
        role: "assistant",
        content: data.response,
        intent: data.intent,
        intent_details: data.intentDetails,
        sources,
        created_at: new Date().toISOString(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      if (data.intent && data.intentDetails) {
        setPendingIntent({
          intent: data.intent,
          details: data.intentDetails,
        });
      }
    } catch {
      setMessages(prev => [...prev, {
        id: "msg-" + Date.now() + "-err",
        role: "assistant",
        content: "Sorry, I'm having trouble connecting. Please try again or contact HR for assistance.",
        created_at: new Date().toISOString(),
      }]);
    }

    setLoading(false);
  };

  const confirmRequest = async () => {
    if (!pendingIntent || !user) return;
    setCreating(true);

    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: user.employee_id,
          employee_name: user.name,
          department: "",
          category: pendingIntent.details.category,
          type: pendingIntent.details.type,
          description: pendingIntent.details.description,
          priority: pendingIntent.details.priority,
        }),
      });

      if (!res.ok) throw new Error("Failed to create request");

      setMessages(prev => [...prev, {
        id: "msg-" + Date.now() + "-confirm",
        role: "assistant",
        content: "Support request created: " + pendingIntent.details.type + " (" + pendingIntent.details.priority + " priority). You can track its status in the Requests page.",
        created_at: new Date().toISOString(),
      }]);
      setPendingIntent(null);
    } catch {
      setMessages(prev => [...prev, {
        id: "msg-" + Date.now() + "-err2",
        role: "assistant",
        content: "Failed to create the support request. Please try again or contact HR directly.",
        created_at: new Date().toISOString(),
      }]);
    }

    setCreating(false);
  };

  const dismissIntent = () => setPendingIntent(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!user) return null;

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Ask OnboardAI</h1>
        <p className="mt-1 text-sm text-gray-500">Your AI assistant for onboarding, policies, and support</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card className="flex flex-col h-[600px]">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map(msg => (
                <div key={msg.id} className={"flex gap-3 " + (msg.role === "user" ? "justify-end" : "")}>
                  {msg.role === "assistant" && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100">
                      <Bot className="h-4 w-4 text-indigo-600" />
                    </div>
                  )}
                  <div className={"max-w-[80%] rounded-2xl px-4 py-3 " + (msg.role === "user" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-900")}>
                    <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <p className="text-xs font-medium text-gray-500 mb-1">Sources:</p>
                        {msg.sources.map((s, i) => (
                          <div key={i} className="text-xs text-gray-400 mb-0.5">
                            {s.title}{s.section ? " - " + s.section : ""}
                            {s.similarity ? " (" + s.similarity + "% match)" : ""}
                          </div>
                        ))}
                      </div>
                    )}
                    {msg.intent && (
                      <div className="mt-2 flex items-center gap-2">
                        <Badge variant="warning">Action needed</Badge>
                        <span className="text-xs opacity-70">{msg.intent}</span>
                      </div>
                    )}
                    <p className="mt-1 text-xs opacity-50">{new Date(msg.created_at).toLocaleTimeString()}</p>
                  </div>
                  {msg.role === "user" && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600">
                      <User className="h-4 w-4 text-white" />
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100">
                    <Bot className="h-4 w-4 text-indigo-600" />
                  </div>
                  <div className="rounded-2xl bg-gray-100 px-4 py-3">
                    <LoadingSpinner size="sm" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {pendingIntent && (
              <div className="mx-6 mb-2 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-800">Support Request Detected</p>
                    <p className="text-xs text-amber-700 mt-1">
                      {pendingIntent.details.type} ({pendingIntent.details.category}) - {pendingIntent.details.priority} priority
                    </p>
                    <p className="text-xs text-amber-600 mt-1">Would you like to create a support request?</p>
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" onClick={confirmRequest} loading={creating}>
                        <CheckCircle className="mr-1 h-4 w-4" /> Confirm
                      </Button>
                      <Button size="sm" variant="outline" onClick={dismissIntent}>
                        <X className="mr-1 h-4 w-4" /> Dismiss
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="border-t p-4">
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about policies, tasks, or report an issue..."
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  disabled={loading}
                />
                <Button onClick={handleSend} disabled={loading || !input.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <div className="p-4">
              <h3 className="text-sm font-semibold text-gray-900">Quick Questions</h3>
              <div className="mt-3 space-y-2">
                {[
                  "What is the work from home policy?",
                  "How many casual leaves do I have?",
                  "What documents do I need to submit?",
                  "When is my security training due?",
                ].map(q => (
                  <button
                    key={q}
                    onClick={() => { setInput(q); }}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-left text-xs text-gray-600 hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-4">
              <h3 className="text-sm font-semibold text-gray-900">Report Issues</h3>
              <div className="mt-3 space-y-2">
                {[
                  "I don't have GitHub access",
                  "My laptop is not working",
                  "I haven't received my company email",
                  "I need access to the HR system",
                ].map(q => (
                  <button
                    key={q}
                    onClick={() => { setInput(q); }}
                    className="w-full rounded-lg border border-amber-200 px-3 py-2 text-left text-xs text-amber-700 hover:border-amber-300 hover:bg-amber-50 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
