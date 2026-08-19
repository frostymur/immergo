"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";

/**
 * The lesson page (/workspace) is a full-screen whiteboard experience —
 * no sidebar, no offset. Everywhere else keeps the standard shell.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLesson = pathname?.startsWith("/workspace");

  if (isLesson) {
    return <div className="flex min-h-screen">{children}</div>;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col ml-0 lg:ml-[280px]">{children}</div>
    </div>
  );
}
