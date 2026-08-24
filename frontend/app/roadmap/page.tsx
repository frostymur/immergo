"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowUpRight, BarChart3, BookOpen, Check, CheckCircle2, Clock, Flag, GraduationCap, Loader2, Settings, Target, Zap } from "lucide-react";
import { useLocale, type Locale } from "@/components/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { apiRoadmap, type Goal, type RoadmapData } from "@/lib/api";
import Confetti from "@/components/Confetti";

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
    current: "Алдыңғы кезең",
    stagesWord: "кезең",
    planDone: "Жоспар аяқталды! 🎉",
    subjectLabel: "Пән",
    gradeLabel: "Сынып",
    build: "Жоспар құрастыру",
    editPlan: "Баптауларды өзгерту",
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
    current: "Текущий этап",
    stagesWord: "этап",
    planDone: "План выполнен! 🎉",
    subjectLabel: "Предмет",
    gradeLabel: "Класс",
    build: "Составить план",
    editPlan: "Сменить настройки",
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
    current: "In progress",
    stagesWord: "stages",
    planDone: "Plan complete! 🎉",
    subjectLabel: "Subject",
    gradeLabel: "Grade",
    build: "Build my plan",
    editPlan: "Change settings",
  },
};

const SUBJECTS: Record<Locale, string[]> = {
  kz: ["Математика", "Физика", "Химия", "Биология", "Информатика", "География"],
  ru: ["Математика", "Физика", "Химия", "Биология", "Информатика", "География"],
  en: ["Math", "Physics", "Chemistry", "Biology", "Computer Science", "Geography"],
};

const GOALS: Record<Locale, { id: Goal; label: string }[]> = {
  kz: [
    { id: "ent", label: "ЕНТ" },
    { id: "olympiad", label: "Олимпиада" },
    { id: "school", label: "Мектеп бағдарламасы" },
  ],
  ru: [
    { id: "ent", label: "ЕНТ" },
    { id: "olympiad", label: "Олимпиада" },
    { id: "school", label: "Школьная программа" },
  ],
  en: [
    { id: "ent", label: "UNT" },
    { id: "olympiad", label: "Olympiad" },
    { id: "school", label: "School program" },
  ],
};

const GRADES = ["7", "8", "9", "10", "11", "12"];

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
  const grade = searchParams.get("grade") || "";
  const weakTopics = (searchParams.get("weak") || "").split(",").map((s) => s.trim()).filter(Boolean);

  // Deep links (diagnostic result, dashboard) skip the constructor.
  const [step, setStep] = useState<"setup" | "plan">(() => (searchParams.get("topic") ? "plan" : "setup"));
  const [draft, setDraft] = useState({
    subject: searchParams.get("topic") || "",
    grade: searchParams.get("grade") || "12",
    goal: (searchParams.get("goal") || "ent") as Goal,
    level: (searchParams.get("level") || "intermediate") as "beginner" | "intermediate" | "advanced",
  });
  const buildPlan = () => {
    if (!draft.subject) return;
    router.replace(
      `/roadmap?topic=${encodeURIComponent(draft.subject)}&goal=${draft.goal}&level=${draft.level}&grade=${draft.grade}`
    );
    setStep("plan");
  };

  const [plan, setPlan] = useState<RoadmapData | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [deadline, setDeadline] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [nowMs] = useState(() => Date.now());
  const [xpBurst, setXpBurst] = useState<{ key: number } | null>(null);
  const [confetti, setConfetti] = useState(0);
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
          .eq("goal", goal)
          .eq("level", level)
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
        data = await apiRoadmap(topic, goal, locale, level, weakTopics, grade);
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
  }, [topic, goal, level, grade, locale]);

  const toggleStage = async (index: number) => {
    if (!plan) return;
    const next = new Set(completed);
    const completing = !next.has(index);
    if (completing) {
      next.add(index);
      setXpBurst((prev) => ({ key: (prev?.key ?? 0) + 1 }));
      if (next.size === plan.stages.length) setConfetti((c) => c + 1);
    } else {
      next.delete(index);
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
  const daysLeft = deadline ? Math.max(0, Math.ceil((new Date(deadline).getTime() - nowMs) / 86400000)) : null;
  const currentIndex = plan ? plan.stages.findIndex((_, i) => !completed.has(i)) : -1;
  const ringR = 52;
  const ringC = 2 * Math.PI * ringR;

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
        {step === "setup" ? (
          <div className="space-y-8 max-w-2xl">
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold text-foreground">{t.title}</h1>
              <p className="text-sm text-muted">{t.subtitle}</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <BookOpen size={15} className="text-primary" /> {t.subjectLabel}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {SUBJECTS[locale].map((s) => (
                  <button
                    key={s}
                    onClick={() => setDraft({ ...draft, subject: s })}
                    className={`py-2.5 text-sm font-medium border transition-all ${
                      draft.subject === s
                        ? "bg-primary text-foreground border-primary"
                        : "bg-surface text-muted border-border hover:border-primary"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <GraduationCap size={15} className="text-primary" /> {t.gradeLabel}
              </div>
              <div className="grid grid-cols-4 gap-2 max-w-xs">
                {GRADES.map((g) => (
                  <button
                    key={g}
                    onClick={() => setDraft({ ...draft, grade: g })}
                    className={`py-2.5 text-sm font-medium border transition-all ${
                      draft.grade === g
                        ? "bg-primary text-foreground border-primary"
                        : "bg-surface text-muted border-border hover:border-primary"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <BarChart3 size={15} className="text-primary" /> {t.goal}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {GOALS[locale].map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setDraft({ ...draft, goal: g.id })}
                    className={`py-3 px-4 text-sm font-medium border transition-all text-left ${
                      draft.goal === g.id
                        ? "bg-primary text-foreground border-primary"
                        : "bg-surface text-muted border-border hover:border-primary"
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Target size={15} className="text-primary" /> {t.level}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {([
                  ["beginner", t.levelBeginner],
                  ["intermediate", t.levelIntermediate],
                  ["advanced", t.levelAdvanced],
                ] as const).map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setDraft({ ...draft, level: id })}
                    className={`py-3 px-4 text-sm font-medium border transition-all text-left ${
                      draft.level === id
                        ? "bg-primary text-foreground border-primary"
                        : "bg-surface text-muted border-border hover:border-primary"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={buildPlan}
              disabled={!draft.subject}
              className="flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-3 bg-primary hover:bg-primary-hover text-foreground text-sm font-medium transition-all disabled:opacity-40"
            >
              <Zap size={15} /> {t.build}
            </button>
          </div>
        ) : (
          <>
        <div className="space-y-2 mb-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-3xl font-semibold text-foreground">{t.title}</h1>
              <p className="text-sm text-muted">{t.subtitle}</p>
            </div>
            <button
              onClick={() => setStep("setup")}
              className="flex items-center gap-1.5 shrink-0 border border-border px-3 py-1.5 text-xs text-muted hover:border-primary hover:text-foreground transition-colors"
            >
              <Settings size={12} /> {t.editPlan}
            </button>
          </div>
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
            {/* Hero: goal facts + big progress ring + stage strip */}
            <div className="border border-border bg-surface bg-gradient-to-br from-primary/5 to-transparent overflow-hidden">
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-6 p-5 sm:p-6 items-center">
                <div className="min-w-0 space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider border border-border px-2.5 py-1 text-foreground">
                      <Target size={11} className="text-primary" /> {t.goal}: {plan.goal.toUpperCase()}
                    </span>
                    <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider border border-border px-2.5 py-1 text-foreground">
                      {t.level}:
                      {plan.level === "advanced"
                        ? t.levelAdvanced
                        : plan.level === "beginner"
                          ? t.levelBeginner
                          : t.levelIntermediate}
                    </span>
                    <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider border border-border px-2.5 py-1 text-foreground">
                      <Clock size={11} className="text-primary" /> {plan.total_weeks || plan.stages.length} {t.weeks}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
                    {daysLeft !== null && (
                      <div>
                        <div className="text-3xl font-semibold text-foreground leading-none">{daysLeft}</div>
                        <div className="font-mono text-[9px] uppercase tracking-widest text-muted mt-1">
                          {t.days} {t.deadlineIn}
                        </div>
                      </div>
                    )}
                    <div>
                      <div className="text-3xl font-semibold text-foreground leading-none">
                        {completed.size}
                        <span className="text-lg text-muted">/{plan.stages.length}</span>
                      </div>
                      <div className="font-mono text-[9px] uppercase tracking-widest text-muted mt-1">
                        {t.stagesWord}
                      </div>
                    </div>
                  </div>

                  {/* stage strip — a glance over the whole journey */}
                  <div className="flex items-center gap-1 pt-1">
                    {plan.stages.map((_, i) => (
                      <span
                        key={i}
                        className={`h-1.5 rounded-full transition-all ${
                          completed.has(i)
                            ? "w-6 bg-green-500"
                            : i === currentIndex
                              ? "w-9 bg-primary"
                              : "w-4 bg-border"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <div className="relative w-28 h-28 justify-self-center sm:justify-self-end">
                  <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                    <circle cx="60" cy="60" r={ringR} className="stroke-border" strokeWidth="8" fill="none" />
                    <circle
                      cx="60"
                      cy="60"
                      r={ringR}
                      className={progressPct >= 100 ? "stroke-green-500" : "stroke-primary"}
                      strokeWidth="8"
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray={ringC}
                      strokeDashoffset={ringC * (1 - progressPct / 100)}
                      style={{ transition: "stroke-dashoffset 600ms ease" }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-semibold text-foreground">{progressPct}%</span>
                    <span className="font-mono text-[8px] uppercase tracking-widest text-muted">{t.progress}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Timeline with a progress-filled spine */}
            <div className="relative">
              <div className="absolute left-[19px] top-8 bottom-8 w-0.5 bg-border">
                <div
                  className="w-full bg-gradient-to-b from-primary to-green-500 transition-all"
                  style={{ height: `${(completed.size / plan.stages.length) * 100}%` }}
                />
              </div>
              {plan.stages.map((s, i) => {
                const done = completed.has(i);
                const current = i === currentIndex;
                const isLast = i === plan.stages.length - 1;
                return (
                  <div key={i} className="relative flex gap-4 sm:gap-5 pb-6 last:pb-0">
                    <div className="relative z-10 shrink-0 pt-1">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center border-2 font-mono text-sm ${
                          done
                            ? "bg-green-500 border-green-500 text-white"
                            : current
                              ? "bg-primary border-primary text-foreground ring-4 ring-primary/15"
                              : "bg-surface border-border text-muted"
                        }`}
                      >
                        {done ? <Check size={16} /> : i + 1}
                      </div>
                    </div>
                    <div className={`flex-1 min-w-0 ${done ? "opacity-60" : ""}`}>
                      <div
                        className={`p-5 border transition-colors ${
                          current ? "border-primary bg-primary/[0.03]" : "bg-surface border-border"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`font-mono text-[9px] uppercase tracking-widest border px-2 py-0.5 ${
                                current ? "border-primary text-primary" : "border-border text-muted"
                              }`}
                            >
                              {t.week} {i + 1}
                            </span>
                            {isLast && (
                              <span className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest text-primary border border-primary/40 bg-primary/10 px-2 py-0.5">
                                <Flag size={9} /> {t.finalStage}
                              </span>
                            )}
                            {current && (
                              <span className="font-mono text-[9px] uppercase tracking-widest text-foreground bg-primary/10 border border-primary/40 px-2 py-0.5">
                                {t.current}
                              </span>
                            )}
                          </div>
                          <span className="flex items-center gap-1.5 shrink-0 font-mono text-[10px] text-muted">
                            <Clock size={11} /> {s.duration}
                          </span>
                        </div>

                        <h3 className="text-base font-semibold text-foreground leading-snug mb-3">{s.title}</h3>

                        <div className="space-y-3">
                          {s.topics?.length > 0 && (
                            <div>
                              <div className="font-mono text-[9px] uppercase tracking-widest text-muted mb-1.5">
                                {t.topics}
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {s.topics.map((tp, ti) => (
                                  <span
                                    key={ti}
                                    className={`text-xs border px-2 py-1 ${
                                      current
                                        ? "border-primary/30 bg-primary/5 text-foreground"
                                        : "border-border text-muted"
                                    }`}
                                  >
                                    {tp}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {s.material && (
                            <div className="flex items-start gap-2">
                              <BookOpen size={13} className="text-muted mt-0.5 shrink-0" />
                              <p className="text-sm text-muted leading-relaxed">{s.material}</p>
                            </div>
                          )}
                          {s.check && (
                            <div className="flex items-start gap-2 border-l-2 border-primary bg-primary/5 px-3 py-2.5">
                              <Target size={13} className="text-primary mt-0.5 shrink-0" />
                              <div className="min-w-0">
                                <div className="font-mono text-[9px] uppercase tracking-widest text-primary mb-0.5">
                                  {t.check}
                                </div>
                                <p className="text-sm text-foreground leading-relaxed">{s.check}</p>
                              </div>
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
                            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all ${
                              current
                                ? "bg-primary hover:bg-primary-hover text-foreground"
                                : "border border-primary text-primary hover:bg-primary/10"
                            }`}
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
          </>
        )}
      </main>

      {/* Reward moment: +20 XP per completed stage */}
      {xpBurst && (
        <div
          key={xpBurst.key}
          className="animate-xp-float fixed bottom-24 left-1/2 z-50 flex items-center gap-1.5 rounded-full bg-green-500 px-4 py-2 text-sm font-semibold text-white shadow-lg"
        >
          <Zap size={14} /> +20 XP
        </div>
      )}
      {plan && completed.size === plan.stages.length && plan.stages.length > 0 && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background shadow-lg animate-pop-in">
          {t.planDone}
        </div>
      )}
      <Confetti burst={confetti} count={160} />
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