"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import Sidebar from "@/components/Sidebar";

const FULLSCREEN_PREFIXES = ["/workspace", "/diagnostic", "/roadmap", "/auth"];

/**
 * Full-screen experiences (/workspace lesson canvas, /diagnostic onboarding,
 * /roadmap plan, /auth) run without the sidebar. Everywhere else keeps the
 * standard shell with navigation.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isFullscreen = FULLSCREEN_PREFIXES.some((p) => pathname?.startsWith(p));

  if (isFullscreen) {
    return <div className="flex min-h-screen">{children}</div>;
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
          immergo
        </button>
      </header>

      <div className="lg:ml-[280px]">{children}</div>
    </div>
  );
}