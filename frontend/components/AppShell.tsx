"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import ReminderBell from "@/components/ReminderBell";
import LogoutButton from "@/components/LogoutButton";
import { createClient } from "@/lib/supabase/client";

const FULLSCREEN_PREFIXES = ["/workspace", "/diagnostic", "/roadmap", "/auth"];

/**
 * Full-screen experiences (/workspace lesson canvas, /diagnostic onboarding,
 * /roadmap plan, /auth) run without the sidebar. Everywhere else keeps the
 * standard shell with navigation.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  // The marketing landing ("/" for anonymous visitors) owns its own pill nav,
  // so the app sidebar stays hidden until we know a session exists.
  const [authed, setAuthed] = useState<boolean | null>(null);
  useEffect(() => {
    const supabase = createClient();
    // Keep auth in sync across sign-in/sign-out so the sidebar/fullscreen
    // layout and the marketing landing update without a page reload.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session);
    });
    supabase.auth.getUser().then(({ data }) => setAuthed(!!data.user));
    return () => sub.subscription.unsubscribe();
  }, []);
  const isFullscreen =
    FULLSCREEN_PREFIXES.some((p) => pathname?.startsWith(p)) || (pathname === "/" && authed !== true);

  if (isFullscreen) {
    return <div className="min-h-screen">{children}</div>;
  }

  return (
    <div className="min-h-screen">
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <header className="sticky top-0 z-30 lg:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-surface">
        <button
          onClick={() => setMobileOpen(true)}
          className="flex items-center gap-2 text-sm font-semibold text-foreground"
          aria-label="Open menu"
        >
          <Menu size={18} />
          <img src="/icon.svg" alt="" className="h-5 w-5" />
          immergo
        </button>
        <div className="flex items-center gap-2">
          <ReminderBell />
          <LogoutButton />
        </div>
      </header>

      <div className="lg:ml-[280px]">{children}</div>
    </div>
  );
}