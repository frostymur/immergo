"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import InputCard from "@/components/InputCard";
import UserAvatar from "@/components/UserAvatar";
import { createClient } from "@/lib/supabase/client";
import { BookOpen, Loader2 } from "lucide-react";

const suggestedPrompts = [
  "Explain integration by parts, with examples",
  "I have a Chemistry test on Friday — bonding",
  "How does photosynthesis work step by step?",
  "Help me understand Newton's third law",
];

type ClassItem = { id: string; title: string; subject: string; grade: string; role: "owner" | "member" };

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const supabase = createClient();

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
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted">[ SYSTEM: ONLINE ]</div>
        <UserAvatar />
      </div>

      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-12">
        <div className="w-full max-w-2xl space-y-8">
          <div className="text-center space-y-4">
            <span className="inline-block font-mono text-[10px] uppercase tracking-widest text-muted border border-border px-2 py-1">
              [ AI STUDY WORKSPACE ]
            </span>
            <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-foreground leading-tight">
              Learn anything.
              <br />
              Ace everything.
            </h1>
            <p className="text-muted text-base max-w-lg mx-auto leading-relaxed">
              Ask Immergo anything. It plans the lesson and works through it with you —
              guiding you step by step on the board, never giving the answer away.
            </p>
          </div>

          <InputCard onSubmit={handleSubmit} loading={loading} />

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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border border border-border">
            <Link href="/workspace" className="bg-surface p-5 hover:bg-surface transition-colors">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted">[ STUDENT ]</div>
              <div className="text-sm font-semibold mt-2">Learn by yourself</div>
              <p className="text-xs text-muted mt-1">
                Upload a PDF. Lumi builds a whiteboard lesson around it and guides you with
                questions until you solve it yourself.
              </p>
            </Link>
            <Link href="/teacher" className="bg-surface p-5 hover:bg-surface transition-colors">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted">[ TEACHER ]</div>
              <div className="text-sm font-semibold mt-2">Teacher console</div>
              <p className="text-xs text-muted mt-1">
                Upload class materials, assign them, and watch a heatmap of where students
                stumble on the board.
              </p>
            </Link>
          </div>

          {/* My classes */}
          {classesLoading ? (
            <div className="flex items-center justify-center gap-2 text-sm text-muted py-2">
              <Loader2 size={14} className="animate-spin" /> Loading classes…
            </div>
          ) : classes.length > 0 ? (
            <div className="border border-border bg-surface">
              <div className="px-4 py-3 border-b border-border font-mono text-[10px] uppercase tracking-widest text-muted">
                [ MY_CLASSES ]
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
