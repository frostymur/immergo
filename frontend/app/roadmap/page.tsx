"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Check, CheckCircle2, Clock, Loader2, Target } from "lucide-react";
import { useLocale, type Locale } from "@/components/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { apiRoadmap, type Goal, type RoadmapData } from "@/lib/api";

const I18N: Record<Locale, Record<string, string>> = {
  kz: {
    tag: "ROADMAP",
    title: "Дайындық жоспары",
    subtitle: "Толық 7-9 апталық жоспар: әр кезеңде теория, материалдар және тексеру. Соңғы кезең — мақсат форматындағы финалдық тест.",
    goal: "Мақсат",
    level: "Дәреже",
    levelBeginner: "Бастауыш",
    levelIntermediate: "Орташа",
    levelAdvanced: "Жоғары",
    weeks: "апта",
    week: "Апта",
    study: "Оқу",
    topics: "Тақырыптар",
    material: "Материалдар",
    check: "Тексеру",
    complete: "Кезеңді аяқтау",
    completed: "Аяқталды",
    fullLesson: "Бірінші сабақты бастау",
    back: "Артқа",
    loading: "Жоспар құрылуда…",
    progress: "прогресс",
    deadlineIn: "мақсатқа қалды",
    days: "күн",
    finalStage: "Финалдық кезең",
    yourGoal: "Мақсатыңыз",
    weakTopics: "Алдымен мына тақырыптарды өту керек",
  },
  ru: {
    tag: "ROADMAP",
    title: "План подготовки",
    subtitle: "Полный план на 7-9 недель: на каждом этапе теория, материалы и проверка. Финальный этап — тест в формате цели.",
    goal: "Цель",
    level: "Уровень",
    levelBeginner: "Начальный",
    levelIntermediate: "Средний",
    levelAdvanced: "Высокий",
    weeks: "недель",
    week: "Неделя",
    study: "Изучить",
    topics: "Темы",
    material: "Материалы",
    check: "Проверка",
    complete: "Завершить этап",
    completed: "Завершено",
    fullLesson: "Начать первый урок",
    back: "Назад",
    loading: "Строим план…",
    progress: "прогресс",
    deadlineIn: "до цели осталось",
    days: "дней",
    finalStage: "Финальный этап",
    yourGoal: "Ваша цель",
    weakTopics: "Сначала проработайте эти темы",
  },
  en: {
    tag: "ROADMAP",
    title: "Study Roadmap",
    subtitle: "A full 7-9 week plan: theory, materials and a check at every stage. The final stage is a mock test in your goal's format.",
    goal: "Goal",
    level: "Level",
    levelBeginner: "Beginner",
    levelIntermediate: "Intermediate",
    levelAdvanced: "Advanced",
    weeks: "weeks",
    week: "Week",
    study: "Study",
    topics: "Topics",
    material: "Materials",
    check: "Check",
    complete: "Complete stage",
    completed: "Completed",
    fullLesson: "Start the first lesson",
    back: "Back",
    loading: "Building roadmap…",
    progress: "progress",
    deadlineIn: "left until the goal",
    days: "days",
    finalStage: "Final stage",
    yourGoal: "Your goal",
    weakTopics: "Tackle these topics first",
  },
};

type SavedPlan = {
  id: string;
  topic: string;
  goal: string;
  level: string;
  stages: RoadmapData["stages"];
  total_weeks: number;
  deadline: string | null;
  created_at: string;
};

function RoadmapPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale } = useLocale();
  const t = I18N[locale];

  const topic = searchParams.get("topic") || "Physics";
  const goal = (searchParams.get("goal") || "ent") as Goal;
  const level = (searchParams.get("level") || "intermediate") as "beginner" | "intermediate" | "advanced";
  const weakTopics = (searchParams.get("weak") || "").split(",").map((s) => s.trim()).filter(Boolean);

  const [plan, setPlan] = useState<RoadmapData | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [deadline, setDeadline] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      let existing: SavedPlan | null = null;
      if (userId) {
        const { data } = await supabase
          .from("roadmap_plans")
          .select("id, topic, goal, level, stages, total_weeks, deadline, created_at")
          .eq("user_id", userId)
          .ilike("topic", topic)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        existing = data as SavedPlan | null;
      }

      if (existing && !cancelled) {
        setPlanId(existing.id);
        setDeadline(existing.deadline);
        setPlan({
          topic: existing.topic,
          goal: existing.goal as Goal,
          level: (existing.level || "intermediate") as RoadmapData["level"],
          stages: existing.stages,
          total_weeks: existing.total_weeks,
          deadline: existing.deadline,
        });
        const { data: progress } = userId
          ? await supabase
              .from("roadmap_progress")
              .select("stage_index")
              .eq("plan_id", existing.id)
          : { data: null };
        if (progress) setCompleted(new Set(progress.map((p) => p.stage_index)));
        setLoading(false);
        return;
      }

      let data: RoadmapData;
      try {
        data = await apiRoadmap(topic, goal, locale, level, weakTopics);
      } catch {
        const demo = await fetch(`/demo/roadmap-${locale}.json`).then((r) => r.json());
        data = {
          topic,
          goal,
          level,
          stages: demo.stages,
          total_weeks: demo.total_weeks || demo.stages.length,
          deadline: null,
        };
      }
      if (cancelled) return;
      setPlan(data);

      const computedDeadline = new Date(Date.now() + (data.total_weeks || data.stages.length) * 7 * 86400000).toISOString();
      setDeadline(computedDeadline);

      if (userId && data.stages.length > 0) {
        const { data: inserted } = await supabase
          .from("roadmap_plans")
          .insert({
            user_id: userId,
            topic,
            goal,
            level,
            stages: data.stages,
            total_weeks: data.total_weeks,
            deadline: computedDeadline,
          })
          .select("id")
          .single();
        if (inserted) setPlanId(inserted.id);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic, goal, locale]);

  const toggleStage = async (index: number) => {
    if (!plan) return;
    const next = new Set(completed);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    setCompleted(next);
    if (planId) {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (!userId) return;
      if (next.has(index)) {
        await supabase
          .from("roadmap_progress")
          .upsert({ plan_id: planId, user_id: userId, stage_index: index });
      } else {
        await supabase.from("roadmap_progress").delete().eq("plan_id", planId).eq("stage_index", index);
      }
    }
  };

  const progressPct = plan ? Math.round((completed.size / plan.stages.length) * 100) : 0;
  const daysLeft = deadline ? Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000)) : null;

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <header className="border-b border-border bg-surface">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-mono text-[10px] uppercase tracking-widest text-primary border border-primary/30 px-2 py-1 shrink-0">
              [ IMMERGO_CANVAS: {t.tag} ]
            </span>
            <span className="text-sm text-foreground truncate">{topic}</span>
          </div>
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors shrink-0"
          >
            <ArrowLeft size={14} /> {t.back}
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-10">
        <div className="space-y-2 mb-8">
          <h1 className="text-2xl font-semibold text-foreground">{t.title}</h1>
          <p className="text-sm text-muted">{t.subtitle}</p>
          {weakTopics.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-primary border border-primary/30 px-2 py-1">
                {t.weakTopics}
              </span>
              {weakTopics.slice(0, 5).map((w, i) => (
                <span key={i} className="text-xs border border-border px-2.5 py-1 text-muted">
                  {w}
                </span>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center gap-3 text-sm text-muted py-16 justify-center">
            <Loader2 size={16} className="animate-spin" /> {t.loading}
          </div>
        ) : plan && plan.stages.length > 0 ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-border border border-border">
              <div className="bg-surface p-4">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted">{t.yourGoal}</div>
                <div className="text-sm font-semibold text-foreground mt-1 uppercase">{plan.goal}</div>
              </div>
              <div className="bg-surface p-4">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted">{t.level}</div>
                <div className="text-sm font-semibold text-foreground mt-1">
                  {plan.level === "advanced"
                    ? t.levelAdvanced
                    : plan.level === "beginner"
                      ? t.levelBeginner
                      : t.levelIntermediate}
                </div>
              </div>
              <div className="bg-surface p-4">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted">{t.weeks}</div>
                <div className="text-sm font-semibold text-foreground mt-1">
                  {plan.total_weeks || plan.stages.length}
                </div>
                {daysLeft !== null && (
                  <div className="text-xs text-muted mt-1 font-mono">
                    {daysLeft} {t.days} {t.deadlineIn}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-surface border border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted">{t.progress}</span>
                <span className="font-mono text-[10px] uppercase text-foreground">{progressPct}%</span>
              </div>
              <div className="h-1.5 bg-border">
                <div className="h-1.5 bg-primary transition-all" style={{ width: `${progressPct}%` }} />
              </div>
            </div>

            <div className="space-y-0">
              {plan.stages.map((s, i) => {
                const done = completed.has(i);
                const isLast = i === plan.stages.length - 1;
                return (
                  <div key={i} className="relative flex gap-4 sm:gap-5">
                    {!isLast && <div className="absolute left-[15px] top-10 bottom-0 w-px bg-border" />}
                    <div className="relative shrink-0">
                      <div
                        className={`w-8 h-8 flex items-center justify-center border font-mono text-xs ${
                          done
                            ? "bg-green-500/90 text-white border-green-500"
                            : i === 0
                              ? "bg-primary text-foreground border-primary"
                              : "bg-surface text-foreground border-border"
                        }`}
                      >
                        {done ? <Check size={14} /> : i + 1}
                      </div>
                    </div>
                    <div className={`flex-1 pb-8 ${done ? "opacity-60" : ""}`}>
                      <div className="bg-surface border border-border p-5">
                        <div className="flex items-start justify-between gap-4 mb-2 flex-wrap">
                          <h3 className="text-sm font-semibold text-foreground leading-snug">
                            {isLast && (
                              <span className="font-mono text-[9px] uppercase tracking-widest text-primary mr-2">
                                [{t.finalStage}]
                              </span>
                            )}
                            {s.title}
                          </h3>
                          <span className="flex items-center gap-1.5 shrink-0 font-mono text-[10px] text-muted border border-border px-2 py-1">
                            <Clock size={11} /> {t.week} {i + 1} · {s.duration}
                          </span>
                        </div>

                        <div className="space-y-3 mt-3">
                          {s.topics?.length > 0 && (
                            <div>
                              <div className="font-mono text-[9px] uppercase tracking-widest text-muted mb-1.5">
                                {t.topics}
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {s.topics.map((tp, ti) => (
                                  <span key={ti} className="text-xs border border-border px-2 py-1 text-foreground">
                                    {tp}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {s.material && (
                            <div>
                              <div className="font-mono text-[9px] uppercase tracking-widest text-muted mb-1">
                                {t.material}
                              </div>
                              <p className="text-sm text-muted leading-relaxed">{s.material}</p>
                            </div>
                          )}
                          {s.check && (
                            <div>
                              <div className="font-mono text-[9px] uppercase tracking-widest text-primary mb-1">
                                {t.check}
                              </div>
                              <p className="text-sm text-foreground leading-relaxed">{s.check}</p>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 mt-4">
                          <button
                            onClick={() =>
                              router.push(
                                `/workspace?topic=${encodeURIComponent(s.topics?.[0] || s.title)}&level=${plan.level}`
                              )
                            }
                            className="flex items-center gap-2 px-4 py-2 border border-primary text-primary hover:bg-primary/10 text-sm font-medium transition-all"
                          >
                            <ArrowUpRight size={13} /> {t.study}
                          </button>
                          <button
                            onClick={() => toggleStage(i)}
                            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all ${
                              done
                                ? "bg-green-500/90 hover:bg-green-500 text-white"
                                : "border border-border text-muted hover:border-primary hover:text-foreground"
                            }`}
                          >
                            {done ? <CheckCircle2 size={14} /> : <Check size={14} />}
                            {done ? t.completed : t.complete}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => router.push(`/workspace?topic=${encodeURIComponent(plan.stages[0].topics?.[0] || topic)}&level=${plan.level}`)}
              className="flex items-center justify-center gap-2 w-full px-5 py-3.5 bg-primary hover:bg-primary-hover text-foreground text-sm font-medium transition-all"
            >
              <BookOpen size={15} /> {t.fullLesson}
            </button>
          </div>
        ) : (
          <p className="text-sm text-muted">—</p>
        )}
      </main>
    </div>
  );
}

export default function RoadmapPage() {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center min-h-screen" />}>
      <RoadmapPageInner />
    </Suspense>
  );
}