"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MessageSquare, BookOpen, BarChart3, Settings, ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const navItems = [
  { href: "/", label: "Ask anything", icon: MessageSquare },
  { href: "/workspace", label: "Your lessons", icon: BookOpen },
  { href: "/teacher", label: "Insights", icon: BarChart3 },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [user, setUser] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUser(data.user.email || null);
    });
  }, [supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    router.push("/");
  };

  return (
    <aside className="fixed top-0 left-0 h-screen w-[280px] bg-sidebar-bg border-r border-border flex flex-col z-50">
      <div className="px-6 pt-8 pb-6 border-b border-border">
        <span className="font-mono text-lg font-semibold tracking-tight">immergo</span>
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted mt-0.5">
          [ INSTITUTIONAL ]
        </div>
      </div>

      <nav className="flex-1 px-3 py-4">
        <div className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 text-sm transition-colors ${
                  isActive
                    ? "bg-primary text-foreground"
                    : "text-muted hover:bg-surface hover:text-foreground border border-transparent hover:border-primary"
                }`}
              >
                <item.icon size={18} strokeWidth={isActive ? 2.2 : 1.8} />
                <span className="font-mono text-[11px] uppercase tracking-wider">{item.label}</span>
              </Link>
            );
          })}
        </div>

        <div className="my-4 mx-3 border-t border-border" />

        <div className="px-3 mb-2">
          <span className="font-mono text-[10px] text-muted uppercase tracking-widest">Account</span>
        </div>
        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-2.5 text-sm text-muted hover:bg-surface hover:text-foreground border border-transparent hover:border-primary transition-colors"
        >
          <Settings size={18} strokeWidth={1.8} />
          <span className="font-mono text-[11px] uppercase tracking-wider">Settings</span>
        </Link>
      </nav>

      <div className="px-3 pb-6">
        {user ? (
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-3 w-full px-3 py-2.5 border border-border bg-surface hover:border-primary transition-colors"
            >
              <div className="w-8 h-8 bg-primary flex items-center justify-center text-foreground text-xs font-bold">
                {(user || "U").charAt(0).toUpperCase()}
              </div>
              <span className="text-sm font-medium text-foreground flex-1 text-left truncate">
                {user?.split("@")[0] || "User"}
              </span>
              <ChevronDown size={14} className="text-muted" />
            </button>
            {userMenuOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-1 border border-border bg-surface">
                <button
                  onClick={handleSignOut}
                  className="w-full text-left px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link
            href="/auth"
            className="flex items-center justify-center w-full px-3 py-2.5 bg-primary hover:bg-primary-hover text-foreground text-sm font-medium transition-colors"
          >
            <span className="font-mono text-[11px] uppercase tracking-wider">Sign in</span>
          </Link>
        )}
      </div>
    </aside>
  );
}