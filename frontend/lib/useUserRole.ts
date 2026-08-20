"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type UserRole = "student" | "teacher";

export function useUserRole(): { role: UserRole | null; loading: boolean } {
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (!data?.user) {
        if (!cancelled) setLoading(false);
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();
      if (!cancelled) {
        setRole(profile?.role === "teacher" ? "teacher" : "student");
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { role, loading };
}