"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useReminderCount } from "@/lib/useReminderCount";

export default function ReminderBell({ className = "" }: { className?: string }) {
  const { count, ready } = useReminderCount();
  return (
    <Link
      href="/dashboard"
      title="Reminders"
      className={`relative flex items-center justify-center w-8 h-8 rounded-full border border-border text-muted hover:text-foreground hover:border-foreground transition-colors ${className}`}
    >
      <Bell size={14} />
      {ready && count > 0 && (
        <span className="absolute -top-1 -right-1 min-w-4 h-4 px-0.5 rounded-full bg-red-500 text-white text-[9px] font-semibold flex items-center justify-center">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
