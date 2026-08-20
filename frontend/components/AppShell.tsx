"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";

const FULLSCREEN_PREFIXES = ["/workspace", "/diagnostic", "/roadmap", "/auth"];

/**
 * Full-screen experiences (/workspace lesson canvas, /diagnostic onboarding,
 * /roadmap plan, /auth) run without the sidebar. Everywhere else keeps the
 * standard shell with navigation.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isFullscreen = FULLSCREEN_PREFIXES.some((p) => pathname?.startsWith(p));

  if (isFullscreen) {
    return <div className="flex min-h-screen">{children}</div>;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col ml-0 lg:ml-[280px]">{children}</div>
    </div>
  );
}
