"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import InputCard from "@/components/InputCard";
import UserAvatar from "@/components/UserAvatar";
import { useLocale } from "@/components/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { BookOpen, Loader2 } from "lucide-react";

type ClassItem = { id: string; title: string; subject: string; grade: string; role: "owner" | "member" };

export default function Home() {
  const router = useRouter();
  const { locale, t } = useLocale();
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const supabase = createClient();

  const suggestedPrompts =
    locale === "kz"
      ? [
          "Бөлшектеп интегралдауды мысалдармен түсіндір",
          "Жексенбіде химиядан тест — байланыстар",
          "Фотосинтез қалай жүреді, қадам-қадам?",
          "Ньютонның үшінші заңын түсінуге көмектес",
        ]
      : locale === "ru"
        ? [
            "Объясни интегрирование по частям с примерами",
            "В пятницу тест по химии — химические связи",
            "Как протекает фотосинтез по шагам?",
            "Помоги понять третий закон Ньютона",
          ]
        : [
            "Explain integration by parts, with examples",
            "I have a Chemistry test on Friday — bonding",
            "How does photosynthesis work step by step?",
            "Help me understand Newton's third law",
          ];

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setClassesLoading(false);
        return;
      }
      const userId = userData.user.id;

      // Owned workspaces
      const { data: owned } = await supabase
        .from("workspaces")
        .select("id, title, subject, grade")
        .eq("user_id", userId);

      // Memberships
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
      setClassesLoading(false);
    })();
  }, [supabase]);

  const handleSubmit = (text: string) => {
    setLoading(true);
    router.push(`/workspace?topic=${encodeURIComponent(text)}`);
  };

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted">[ {t("home.system")} ]</div>
        <UserAvatar />
      </div>

      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-12">
        <div className="w-full max-w-2xl space-y-8">
          <div className="text-center space-y-4">
            <span className="inline-block font-mono text-[10px] uppercase tracking-widest text-muted border border-border px-2 py-1">
              [ {t("landing.title")} ]
            </span>
            <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-foreground leading-tight">
              {t("landing.hero1")}
              <br />
              {t("landing.hero2")}
            </h1>
            <p className="text-muted text-base max-w-lg mx-auto leading-relaxed">
              {t("landing.desc")}
            </p>
          </div>

          <InputCard onSubmit={handleSubmit} loading={loading} placeholder={t("landing.prompt")} />

          <div className="flex flex-wrap justify-center gap-2">
            {suggestedPrompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => handleSubmit(prompt)}
                className="px-4 py-2 border border-border text-sm text-muted hover:border-primary hover:text-foreground transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border border border-border">
            <Link href="/diagnostic" className="bg-surface p-5 hover:bg-surface transition-colors">
              <div className="font-mono text-[10px] uppercase tracking-widest text-primary">[ {t("diagnostic.mode")} ]</div>
              <div className="text-sm font-semibold mt-2">{t("diagnostic.mode")}</div>
              <p className="text-xs text-muted mt-1">{t("diagnostic.desc")}</p>
            </Link>
            <Link href="/workspace" className="bg-surface p-5 hover:bg-surface transition-colors">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted">[ {t("student.mode")} ]</div>
              <div className="text-sm font-semibold mt-2">{t("student.mode")}</div>
              <p className="text-xs text-muted mt-1">{t("student.desc")}</p>
            </Link>
            <Link href="/teacher" className="bg-surface p-5 hover:bg-surface transition-colors">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted">[ {t("teacher.mode")} ]</div>
              <div className="text-sm font-semibold mt-2">{t("teacher.mode")}</div>
              <p className="text-xs text-muted mt-1">{t("teacher.desc")}</p>
            </Link>
          </div>

          {/* My classes */}
          {classesLoading ? (
            <div className="flex items-center justify-center gap-2 text-sm text-muted py-2">
              <Loader2 size={14} className="animate-spin" /> {t("classes.loading")}
            </div>
          ) : classes.length > 0 ? (
            <div className="border border-border bg-surface">
              <div className="px-4 py-3 border-b border-border font-mono text-[10px] uppercase tracking-widest text-muted">
                [ {t("my.classes")} ]
              </div>
              <div className="divide-y divide-border">
                {classes.map((c) => (
                  <Link
                    key={c.id}
                    href={c.role === "owner" ? "/teacher" : `/workspace?workspace_id=${c.id}`}
                    className="flex items-center justify-between p-4 hover:bg-surface transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <BookOpen size={14} className="text-muted" />
                      <div>
                        <div className="text-sm font-medium">{c.title}</div>
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
          ) : null}
        </div>
      </main>
    </div>
  );
}
