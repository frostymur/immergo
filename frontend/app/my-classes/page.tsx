"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/LocaleProvider";
import { BookOpen, Loader2 } from "lucide-react";

type ClassItem = { id: string; title: string; subject: string; grade: string; role: "owner" | "member" };

export default function MyClassesPage() {
  const { t } = useLocale();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setLoading(false);
        return;
      }
      const userId = userData.user.id;

      const { data: owned } = await supabase
        .from("workspaces")
        .select("id, title, subject, grade")
        .eq("user_id", userId);

      const { data: memberships } = await supabase
        .from("class_memberships")
        .select("workspace_id, workspaces(id, title, subject, grade)")
        .eq("student_id", userId);

      const map = new Map<string, ClassItem>();
      for (const w of owned || []) {
        map.set(w.id, { ...w, role: "owner" });
      }
      for (const m of memberships || []) {
        const w = (m as any).workspaces;
        if (!w || map.has(w.id)) continue;
        map.set(w.id, { ...w, role: "member" });
      }
      setClasses([...map.values()]);
      setLoading(false);
    })();
  }, [supabase]);

  return (
    <div className="flex flex-col min-h-screen">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted">[ {t("nav.lessons")} ]</div>
      </header>

      <main className="flex-1 p-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 text-sm text-muted py-10">
              <Loader2 size={14} className="animate-spin" /> {t("classes.loading")}
            </div>
          ) : classes.length === 0 ? (
            <div className="border border-border bg-surface p-10 text-center">
              <div className="text-sm text-muted">{t("teacher.noClasses")}</div>
              <Link
                href="/teacher"
                className="inline-block mt-4 border border-border px-4 py-2 text-sm font-medium hover:border-primary transition-colors"
              >
                {t("teacher.createClass")}
              </Link>
            </div>
          ) : (
            <div className="border border-border bg-surface">
              <div className="px-4 py-3 border-b border-border font-mono text-[10px] uppercase tracking-widest text-muted">
                [ {t("nav.lessons")} ]
              </div>
              <div className="divide-y divide-border">
                {classes.map((c) => (
                  <Link
                    key={c.id}
                    href={c.role === "owner" ? "/teacher" : `/workspace?workspace_id=${c.id}`}
                    className="flex items-center justify-between p-4 hover:bg-surface transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <BookOpen size={14} className="text-muted shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{c.title}</div>
                        <div className="text-xs text-muted">
                          {c.subject} {c.grade ? `/ Grade ${c.grade}` : ""}
                        </div>
                      </div>
                    </div>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted border border-border px-2 py-0.5">
                      {c.role === "owner" ? "TEACH" : "STUDY"}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}