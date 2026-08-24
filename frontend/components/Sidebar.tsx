"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Settings, ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/LocaleProvider";
import { useUserRole } from "@/lib/useUserRole";
import ReminderBell from "@/components/ReminderBell";

export default function Sidebar({ mobileOpen, onMobileClose }: { mobileOpen?: boolean; onMobileClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLocale();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [user, setUser] = useState<string | null>(null);
  const supabase = createClient();
  const { role } = useUserRole();

  const navItems = [
    { href: "/", label: t("landing.title") },
    { href: "/dashboard", label: t("nav.dashboard") },
    { href: "/my-classes", label: t("nav.lessons") },
    { href: "/roadmap", label: t("nav.roadmap") },
    ...(role === "teacher" ? [{ href: "/teacher", label: t("nav.teacher") }] : []),
  ];

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUser(data.user.email || null);
    });
  }, [supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    onMobileClose?.();
    router.push("/");
  };

  return (
    <aside
      className={`fixed top-0 left-0 h-dvh w-[280px] max-w-[85vw] bg-sidebar-bg border-r border-border flex flex-col z-50 transition-transform duration-200 lg:translate-x-0 ${
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="flex items-start justify-between px-6 pt-8 pb-6 border-b border-border">
        <div>
          <Link href="/" className="font-mono text-lg font-semibold tracking-tight flex items-center gap-2 hover:opacity-80 transition-opacity"><img src="/icon.svg" alt="" className="h-6 w-6" />immergo</Link>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted mt-0.5">
            [ INSTITUTIONAL ]
          </div>
        </div>
        <ReminderBell />
      </div>

      <nav className="flex-1 px-3 py-4">
        <div className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onMobileClose}
                className={`flex items-center gap-3 px-3 py-2.5 text-sm transition-colors ${
                  isActive
                    ? "bg-primary text-foreground"
                    : "text-muted hover:bg-surface hover:text-foreground border border-transparent hover:border-primary"
                }`}
              >
                <span className="font-mono text-[11px] uppercase tracking-wider">{item.label}</span>
              </Link>
            );
          })}
        </div>

        <div className="my-4 mx-3 border-t border-border" />

        <div className="px-3 mb-2">
          <span className="font-mono text-[10px] text-muted uppercase tracking-widest">{t("auth.profile")}</span>
        </div>
        <Link
          href="/settings"
          onClick={onMobileClose}
          className="flex items-center gap-3 px-3 py-2.5 text-sm text-muted hover:bg-surface hover:text-foreground border border-transparent hover:border-primary transition-colors"
        >
          <Settings size={18} strokeWidth={1.8} />
          <span className="font-mono text-[11px] uppercase tracking-wider">{t("nav.settings")}</span>
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
                {user?.split("@")[0] || t("nav.you")}
              </span>
              <ChevronDown size={14} className="text-muted" />
            </button>
            {userMenuOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-1 border border-border bg-surface">
                <button
                  onClick={handleSignOut}
                  className="w-full text-left px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  {t("nav.signout")}
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link
            href="/auth"
            onClick={onMobileClose}
            className="flex items-center justify-center w-full px-3 py-2.5 bg-primary hover:bg-primary-hover text-foreground text-sm font-medium transition-colors"
          >
            <span className="font-mono text-[11px] uppercase tracking-wider">{t("auth.login")}</span>
          </Link>
        )}
      </div>
    </aside>
  );
}