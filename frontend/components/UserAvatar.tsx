"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function UserAvatar() {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<{ email: string | undefined; name: string | null } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser({
          email: data.user.email,
          name: (data.user.user_metadata?.full_name as string) || data.user.email || "User",
        });
      }
    });

    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setOpen(false);
    router.push("/");
  };

  if (!user) {
    return (
      <Link
        href="/auth"
        className="bg-foreground hover:bg-primary-hover text-white px-4 py-2 text-sm font-medium transition-colors font-mono text-[11px] uppercase tracking-wider"
      >
        Sign in
      </Link>
    );
  }

  const initial = (user.name || "U").charAt(0).toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2 py-1.5 border border-transparent hover:border-border hover:bg-surface transition-colors"
      >
        <div className="w-8 h-8 bg-foreground flex items-center justify-center text-white text-xs font-bold">
          {initial}
        </div>
        <ChevronDown size={14} className="text-muted" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-border p-2 z-50">
          <div className="px-3 py-2 border-b border-border mb-1">
            <div className="text-sm font-medium text-foreground truncate">{user.name}</div>
            <div className="text-xs text-muted truncate">{user.email}</div>
          </div>
          <Link
            href="/settings"
            className="block w-full text-left px-3 py-2 text-sm text-muted hover:bg-surface transition-colors"
          >
            Settings
          </Link>
          <div className="my-1 border-t border-border" />
          <button
            onClick={handleSignOut}
            className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}