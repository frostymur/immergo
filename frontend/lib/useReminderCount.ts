"use client";

import { useEffect, useState } from "react";
import { createClient } from "./supabase/client";

/**
 * Count of items that would show up in the dashboard "Reminders" panel:
 * - teacher assignments due (overdue or within 48 h) that are not done
 * - the latest study plan whose deadline is within 14 days
 * - spaced-repetition reviews due now or within the next 48 h
 */
export function useReminderCount() {
  const [count, setCount] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user || cancelled) return;
      const uid = data.user.id;
      const nowMs = Date.now();
      const in48h = new Date(nowMs + 48 * 3600000).toISOString();

      let n = 0;

      const [reviews, memberships, plans] = await Promise.all([
        supabase.from("review_schedule").select("id").eq("user_id", uid).lte("next_review_at", in48h),
        supabase.from("class_memberships").select("workspace_id").eq("student_id", uid),
        supabase.from("roadmap_plans").select("deadline").eq("user_id", uid).order("created_at", { ascending: false }).limit(1),
      ]);

      if (!reviews.error && reviews.data) n += reviews.data.length;

      const wsIds = (memberships.data || []).map((m: { workspace_id: string }) => m.workspace_id);
      if (wsIds.length > 0) {
        const { data: asg } = await supabase
          .from("assignments")
          .select("id, deadline")
          .in("workspace_id", wsIds)
          .lte("deadline", in48h);
        const rows = asg || [];
        if (rows.length > 0) {
          const { data: prog } = await supabase
            .from("assignment_progress")
            .select("assignment_id, status")
            .eq("student_id", uid)
            .in("assignment_id", rows.map((a: { id: string }) => a.id));
          const statusByAssign = new Map((prog || []).map((p: { assignment_id: string; status: string }) => [p.assignment_id, p.status]));
          n += rows.filter((a: { id: string; deadline: string | null }) => a.deadline && (statusByAssign.get(a.id) || "assigned") !== "done").length;
        }
      }

      const plan = (plans.data || [])[0] as { deadline: string | null } | undefined;
      if (plan && plan.deadline) {
        const daysLeft = Math.max(0, Math.ceil((new Date(plan.deadline).getTime() - nowMs) / 86400000));
        if (daysLeft <= 14) n += 1;
      }

      if (!cancelled) {
        setCount(n);
        setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { count, ready };
}
