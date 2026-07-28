"use client";

import { useState, useEffect } from "react";

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: string;
  company_id: string;
  company_name: string;
  employee_id?: string;
}

export function useUser() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadUser() {
      try {
        const res = await fetch("/api/auth");
        if (!res.ok) {
          setError("Auth service unavailable");
          setLoading(false);
          return;
        }
        const data = await res.json();
        if (data.user) {
          setUser({
            id: data.user.id,
            name: data.user.full_name,
            email: data.user.email,
            role: data.user.role,
            company_id: data.user.company_id,
            company_name: data.user.company_name,
            employee_id: data.user.employee_id,
          });
        }
      } catch {
        setError("Failed to load user");
      }
      setLoading(false);
    }
    loadUser();
  }, []);

  return { user, loading, error };
}
