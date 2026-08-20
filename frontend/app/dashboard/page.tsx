"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Award, BellRing, BookOpen, CheckCircle2, Flame, Target, TrendingUp, XCircle, ArrowRight, Zap } from "lucide-react";
import { useLocale, type Locale } from "@/components/LocaleProvider";
import { createClient } from "@/lib/supabase/client";

const I18N: Record<Locale, Record<string, string>> = {
  kz: {
    title: "Менің кабинетім",
    tag: "MY CABINET",
    xp: "Тәжірибе",
    level: "Деңгей",
    lessons: "Оқу сабақтары",
    completed: "Аяқталған тапсырмалар",
    failed: "Сәтсіз әрекеттер",
    accuracy: "Дәлдік",
    diagnostics: "Диагностикалар",
    plans: "Дайындық жоспарлары",
    weak: "Слабын жаттықтыру керек тақырыптар",
    noWeak: "Керемет! Әзірге айқын қателіктер жоқ.",
    goal: "Мақсат",
    deadline: "Дедлайн",
    daysLeft: "күн қалды",
    planProgress: "Жоспар прогрессі",
    startPlan: "Жоспарды ашу",
    takeDiagnostic: "Диагностикадан өту",
    noDiagnostic: "Диагностика жоқ — бастау керек",
    noPlan: "Дайындық жоспары жоқ",
    badges: "Жетістіктер",
    badgeDiagnostic: "Бірінші диагностика",
    badgeTasks: "Алғашқы 10 тапсырма",
    badgeAccurate: "Дәлдік 80%+",
    badgePlan: "Жоспар басталды",
    badgePlanDone: "Жоспар аяқталды",
    locked: "Құлпы ашылмаған",
    totalXp: "жалпы тәжірибе",
    last: "Соңғы әрекет",
    streakLabel: "Күн қатарынан",
    newAssignment: "Жаңа тапсырма",
    fromTeacher: "мұғалімнен",
    start: "Бастау",
    entCountdown: "ЕНТ-ге дейін",
    daysLeftShort: "күн",
  },
  ru: {
    title: "Мой кабинет",
    tag: "MY CABINET",
    xp: "Опыт",
    level: "Уровень",
    lessons: "Уроки",
    completed: "Выполненные задания",
    failed: "Неудачные попытки",
    accuracy: "Точность",
    diagnostics: "Диагностики",
    plans: "Планы подготовки",
    weak: "Темы для проработки",
    noWeak: "Отлично! Явных пробелов пока нет.",
    goal: "Цель",
    deadline: "Дедлайн",
    daysLeft: "дней осталось",
    planProgress: "Прогресс плана",
    startPlan: "Открыть план",
    takeDiagnostic: "Пройти диагностику",
    noDiagnostic: "Диагностики нет — начните с неё",
    noPlan: "Плана подготовки нет",
    badges: "Достижения",
    badgeDiagnostic: "Первая диагностика",
    badgeTasks: "Первые 10 заданий",
    badgeAccurate: "Точность 80%+",
    badgePlan: "План запущен",
    badgePlanDone: "План завершён",
    locked: "Не открыто",
    totalXp: "всего опыта",
    last: "Последняя попытка",
    streakLabel: "Дней подряд",
    newAssignment: "Новое задание",
    fromTeacher: "от учителя",
    start: "Начать",
    entCountdown: "До ЕНТ осталось",
    daysLeftShort: "дней",
  },
  en: {
    title: "My Cabinet",
    tag: "MY CABINET",
    xp: "XP",
    level: "Level",
    lessons: "Lessons",
    completed: "Completed tasks",
    failed: "Failed attempts",
    accuracy: "Accuracy",
    diagnostics: "Diagnostics",
    plans: "Study plans",
    weak: "Topics to work on",
    noWeak: "Great! No obvious gaps yet.",
    goal: "Goal",
    deadline: "Deadline",
    daysLeft: "days left",
    planProgress: "Plan progress",
    startPlan: "Open plan",
    takeDiagnostic: "Take a diagnostic",
    noDiagnostic: "No diagnostic yet — start here",
    noPlan: "No study plan yet",
    badges: "Achievements",
    badgeDiagnostic: "First diagnostic",
    badgeTasks: "First 10 tasks",
    badgeAccurate: "80%+ accuracy",
    badgePlan: "Plan started",
    badgePlanDone: "Plan completed",
    locked: "Locked",
    totalXp: "total XP",
    last: "Last attempt",
    streakLabel: "Day streak",
    newAssignment: "New assignment",
    fromTeacher: "from your teacher",
    start: "Start",
    entCountdown: "Days until UNT",
    daysLeftShort: "days",
  },
};

type WeakNode = { node_id: string; errors: number; attempts: number };
type PlanRow = { id: string; topic: string; goal: string; total_weeks: number; deadline: string | null; stages: unknown[] };
type DoneRow = { plan_id: string; count: number };
type AssignmentRow = { id: string; workspace_id: string; title: string; topic: string; deadline: string | null };

function ActivityCalendar({
  activeDates,
  total,
  currentStreak,
  maxStreak,
  locale,
}: {
  activeDates: Map<string, number>;
  total: number;
  currentStreak: number;
  maxStreak: number;
  locale: "kz" | "ru" | "en";
}) {
  const l = locale === "kz" ? "kk-KZ" : locale === "ru" ? "ru-RU" : "en-US";
  const t = {
    kz: { submissions: "белсенділік (соңғы 4 ай)", total: "Барлығы", max: "Макс стрик", current: "Қазіргі стрик" },
    ru: { submissions: "активностей (за 4 месяца)", total: "Всего дней", max: "Макс стрик", current: "Текущий" },
    en: { submissions: "activities (past 4 months)", total: "Total active days", max: "Max streak", current: "Current" },
  }[locale];

  const WEEKS = 16;
  const columns = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dayOfWeek = today.getDay();
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - (WEEKS - 1) * 7 - dayOfWeek);

  for (let w = 0; w < WEEKS; w++) {
    const col = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + w * 7 + d);
      if (date > today) {
        col.push(null);
      } else {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, "0");
        const dd = String(date.getDate()).padStart(2, "0");
        const dateStr = `${yyyy}-${mm}-${dd}`;
        const count = activeDates.get(dateStr) || 0;
        col.push({ dateStr, count, dateObj: date });
      }
    }
    columns.push(col);
  }

  const monthLabels: { label: string; colIndex: number }[] = [];
  let lastMonth = -1;
  columns.forEach((col, i) => {
    if (col[0]) {
      const m = col[0].dateObj.getMonth();
      if (m !== lastMonth) {
        if (i > 0 || col[0].dateObj.getDate() <= 15) {
          monthLabels.push({ label: col[0].dateObj.toLocaleString(l, { month: "short" }), colIndex: i });
        }
        lastMonth = m;
      }
    }
  });

  return (
    <div className="bg-surface border border-border p-5">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4 text-sm">
        <div>
          <span className="font-semibold text-foreground">{Array.from(activeDates.values()).reduce((a, b) => a + b, 0)}</span> <span className="text-muted">{t.submissions}</span>
        </div>
        <div className="flex items-center gap-4 text-muted text-xs">
          <span>{t.total}: <strong className="text-foreground">{total}</strong></span>
          <span>{t.max}: <strong className="text-foreground">{maxStreak}</strong></span>
          <span className="bg-surface border border-border px-2 py-1 rounded">
            {t.current} <strong className="text-foreground">{currentStreak}</strong>
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-1 overflow-x-auto pb-2">
        <div className="flex text-[10px] text-muted mb-1 relative h-4">
          {monthLabels.map((m, i) => (
            <span key={i} className="absolute capitalize" style={{ left: `${m.colIndex * 15}px` }}>{m.label}</span>
          ))}
        </div>
        <div className="flex gap-[3px]">
          {columns.map((col, w) => (
            <div key={w} className="flex flex-col gap-[3px]">
              {col.map((day, d) => {
                if (!day) return <div key={d} className="w-[12px] h-[12px]" />;
                const intensity = day.count === 0 ? "bg-border/50" : day.count < 3 ? "bg-primary/40" : day.count < 6 ? "bg-primary/70" : "bg-primary";
                return (
                  <div
                    key={d}
                    title={`${day.count} activities on ${day.dateStr}`}
                    className={`w-[12px] h-[12px] rounded-sm ${intensity} ${day.count > 0 ? "shadow-[0_0_2px_rgba(0,0,0,0.1)]" : ""}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { locale } = useLocale();
  const t = I18N[locale];
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [stats, setStats] = useState({
    completed: 0,
    failed: 0,
    diagnostics: 0,
    plans: 0,
    planDone: 0,
    planStagesTotal: 0,
  });
  const [weak, setWeak] = useState<WeakNode[]>([]);
  const [lastDiagnostic, setLastDiagnostic] = useState<{ subject: string; goal: string; correct: number; total: number } | null>(null);
  const [plan, setPlan] = useState<PlanRow | null>(null);
  const [planDoneCount, setPlanDoneCount] = useState(0);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);

  const [activeDates, setActiveDates] = useState<Map<string, number>>(new Map());
  const [streak, setStreak] = useState({ current: 0, max: 0, total: 0 });

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.replace("/auth");
        return;
      }
      setAuthed(true);
      const userId = userData.user.id;

      const { data: progress } = await supabase
        .from("student_progress")
        .select("status, error_count, node_id, created_at")
        .eq("student_id", userId);
      const completed = (progress || []).filter((p) => p.status === "completed").length;
      const failed = (progress || []).filter((p) => p.status === "failed").length;

      const weakMap = new Map<string, WeakNode>();
      const aMap = new Map<string, number>();

      for (const p of progress || []) {
        if (p.created_at) {
          const d = new Date(p.created_at);
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const dd = String(d.getDate()).padStart(2, "0");
          const dateStr = `${yyyy}-${mm}-${dd}`;
          aMap.set(dateStr, (aMap.get(dateStr) || 0) + 1);
        }

        if (p.status !== "failed") continue;
        const n = weakMap.get(p.node_id) || { node_id: p.node_id, errors: 0, attempts: 0 };
        n.errors += p.error_count || 1;
        n.attempts += 1;
        weakMap.set(p.node_id, n);
      }
      setWeak([...weakMap.values()].sort((a, b) => b.errors - a.errors).slice(0, 5));
      setActiveDates(aMap);

      // Calculate streaks
      const dates = Array.from(aMap.keys()).sort();
      let cur = 0, max = 0, tot = dates.length;
      if (dates.length > 0) {
        let runningStreak = 1;
        max = 1;
        for (let i = 1; i < dates.length; i++) {
          const d1 = new Date(dates[i - 1]);
          const d2 = new Date(dates[i]);
          const diff = Math.round((d2.getTime() - d1.getTime()) / 86400000);
          if (diff === 1) {
            runningStreak++;
            max = Math.max(max, runningStreak);
          } else if (diff > 1) {
            runningStreak = 1;
          }
        }
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, "0");
        const dd = String(today.getDate()).padStart(2, "0");
        const todayStr = `${yyyy}-${mm}-${dd}`;

        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yyyyY = yesterday.getFullYear();
        const mmY = String(yesterday.getMonth() + 1).padStart(2, "0");
        const ddY = String(yesterday.getDate()).padStart(2, "0");
        const yesterdayStr = `${yyyyY}-${mmY}-${ddY}`;

        const lastDate = dates[dates.length - 1];
        if (lastDate === todayStr || lastDate === yesterdayStr) {
          cur = runningStreak;
        } else {
          cur = 0;
        }
      }
      setStreak({ current: cur, max, total: tot });

      const { data: diags } = await supabase
        .from("diagnostic_results")
        .select("subject, goal, correct, total, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1);
      if (diags && diags.length > 0) {
        setLastDiagnostic(diags[0]);
        // Also optionally add diag to activity map, but we'll stick to progress for now
      }

      const { data: plans } = await supabase
        .from("roadmap_plans")
        .select("id, topic, goal, total_weeks, deadline, stages, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1);
      if (plans && plans.length > 0) {
        const p = plans[0];
        setPlan(p);
        const { data: done } = await supabase
          .from("roadmap_progress")
          .select("plan_id, stage_index")
          .eq("plan_id", p.id);
        setPlanDoneCount(done?.length || 0);
      }

      setStats({
        completed,
        failed,
        diagnostics: diags?.length || 0,
        plans: plans?.length || 0,
        planDone: 0,
        planStagesTotal: plans?.[0]?.stages?.length || 0,
      });

      // Teacher assignments for classes the student is in
      const { data: memberships } = await supabase
        .from("class_memberships")
        .select("workspace_id")
        .eq("student_id", userId);
      const wsIds = (memberships || []).map((m) => m.workspace_id);
      if (wsIds.length > 0) {
        const { data: asg } = await supabase
          .from("assignments")
          .select("id, workspace_id, title, topic, deadline")
          .in("workspace_id", wsIds)
          .order("created_at", { ascending: false });
        const rows = asg || [];
        const { data: myProg } = rows.length
          ? await supabase
              .from("assignment_progress")
              .select("assignment_id, status")
              .eq("student_id", userId)
              .in("assignment_id", rows.map((a) => a.id))
          : { data: [] };
        const statusByAssign = new Map((myProg || []).map((p) => [p.assignment_id, p.status]));
        const active = rows.filter(
          (a) =>
            (statusByAssign.get(a.id) || "assigned") !== "done" &&
            (!a.deadline || new Date(a.deadline).getTime() > Date.now())
        );
        setAssignments(active.slice(0, 2));
      }
      setLoading(false);
    })();
  }, [router, supabase]);

  const xp = stats.completed * 5 + stats.diagnostics * 25 + stats.plans * 40 + planDoneCount * 20;
  const accuracy =
    stats.completed + stats.failed > 0
      ? Math.round((stats.completed / (stats.completed + stats.failed)) * 100)
      : null;

  const badges: { id: string; label: string; done: boolean }[] = [
    { id: "diag", label: t.badgeDiagnostic, done: stats.diagnostics > 0 },
    { id: "tasks", label: t.badgeTasks, done: stats.completed >= 10 },
    { id: "acc", label: t.badgeAccurate, done: accuracy !== null && accuracy >= 80 && stats.completed + stats.failed >= 5 },
    { id: "plan", label: t.badgePlan, done: stats.plans > 0 },
    { id: "planDone", label: t.badgePlanDone, done: planDoneCount > 0 && planDoneCount >= stats.planStagesTotal && stats.planStagesTotal > 0 },
  ];
  const badgesOpen = badges.filter((b) => b.done).length;
  const levelName = xp >= 600 ? "Master" : xp >= 250 ? "Achiever" : xp >= 80 ? "Learner" : "Beginner";

  const daysLeft = plan?.deadline ? Math.max(0, Math.ceil((new Date(plan.deadline).getTime() - Date.now()) / 86400000)) : null;
  const planPct = plan ? Math.min(100, Math.round((planDoneCount / plan.stages.length) * 100)) : 0;

  if (!authed) return null;

  return (
    <div className="p-4 sm:p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-foreground">{t.title}</h1>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted mt-0.5">
            [ {t.tag} ]
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted">{t.lessons}…</p>
      ) : (
        <div className="space-y-6">
          {/* Teacher assignments */}
          {assignments.length > 0 && (
            <div className="border-2 border-orange-400 bg-orange-50 p-5 space-y-3">
              {assignments.map((a) => (
                <div key={a.id} className="flex flex-wrap items-center gap-4">
                  <div className="w-11 h-11 bg-orange-500 flex items-center justify-center flex-shrink-0">
                    <BellRing size={20} className="text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-orange-700">
                      [ {t.newAssignment} {t.fromTeacher} ]
                    </div>
                    <div className="text-sm font-semibold text-foreground">{a.title}</div>
                    <div className="text-xs text-muted">
                      {a.topic}
                      {a.deadline && (
                        <span className="text-orange-700 font-medium">
                          {" · "}
                          {t.deadline}: {new Date(a.deadline).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <Link
                    href={`/workspace?workspace_id=${a.workspace_id}&assignment=${a.id}`}
                    className="h-10 px-5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold flex items-center gap-2 transition-colors flex-shrink-0"
                  >
                    {t.start} <ArrowRight size={14} />
                  </Link>
                </div>
              ))}
            </div>
          )}

          {/* Goal countdown widget */}
          {plan && plan.goal === "ent" && daysLeft !== null && (
            <div className="bg-surface border border-primary/40 p-5 flex flex-wrap items-center gap-4">
              <div className="w-12 h-12 bg-primary/10 border border-primary/30 flex items-center justify-center">
                <Target size={22} className="text-primary" />
              </div>
              <div className="flex-1">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted">{t.entCountdown}</div>
                <div className="text-sm font-semibold text-foreground">
                  {plan.topic}
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-primary">{daysLeft}</div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted">{t.daysLeftShort}</div>
              </div>
            </div>
          )}

          {/* XP and Streak card */}
          <div className="bg-surface border border-border p-5 flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-orange-500/10 border border-orange-500/30 flex items-center justify-center">
                <Flame size={22} className="text-orange-500" />
              </div>
              <div>
                <div className="text-2xl font-semibold text-foreground">{streak.current}</div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted">{t.streakLabel}</div>
              </div>
            </div>
            <div className="h-10 w-px bg-border hidden sm:block" />
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-primary/10 border border-primary/30 flex items-center justify-center hidden sm:flex">
                <Zap size={22} className="text-primary" />
              </div>
              <div>
                <div className="text-2xl font-semibold text-foreground">{xp}</div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted">{t.totalXp}</div>
              </div>
            </div>
            <div className="h-10 w-px bg-border hidden sm:block" />
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted">{t.level}</div>
              <div className="text-sm font-semibold text-foreground">{levelName}</div>
            </div>
            <div className="h-10 w-px bg-border hidden sm:block" />
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted">{t.badges}</div>
              <div className="text-sm font-semibold text-foreground">
                {badgesOpen}/{badges.length}
              </div>
            </div>
          </div>

          {/* Activity Calendar */}
          <ActivityCalendar
            activeDates={activeDates}
            total={streak.total}
            currentStreak={streak.current}
            maxStreak={streak.max}
            locale={locale}
          />

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border border border-border">
            <div className="bg-surface p-4">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted">
                <BookOpen size={12} /> {t.completed}
              </div>
              <div className="text-2xl font-semibold text-foreground mt-1">{stats.completed}</div>
            </div>
            <div className="bg-surface p-4">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted">
                <XCircle size={12} /> {t.failed}
              </div>
              <div className="text-2xl font-semibold text-foreground mt-1">{stats.failed}</div>
            </div>
            <div className="bg-surface p-4">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted">
                <TrendingUp size={12} /> {t.accuracy}
              </div>
              <div className="text-2xl font-semibold text-foreground mt-1">
                {accuracy === null ? "—" : `${accuracy}%`}
              </div>
            </div>
            <div className="bg-surface p-4">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted">
                <Target size={12} /> {t.diagnostics}
              </div>
              <div className="text-2xl font-semibold text-foreground mt-1">{stats.diagnostics}</div>
            </div>
          </div>

          {/* Goal + deadline */}
          {plan ? (
            <div className="bg-surface border border-border p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Target size={15} className="text-primary" />
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-muted">{t.goal}</div>
                    <div className="text-sm font-semibold text-foreground">
                      {plan.topic} · <span className="uppercase">{plan.goal}</span>
                    </div>
                  </div>
                </div>
                {daysLeft !== null && (
                  <span className="font-mono text-[10px] uppercase border border-primary/30 bg-primary/10 text-primary px-2 py-1">
                    {daysLeft} {t.daysLeft}
                  </span>
                )}
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted">{t.planProgress}</span>
                  <span className="text-xs text-foreground font-medium">
                    {planDoneCount}/{plan.stages.length} · {planPct}%
                  </span>
                </div>
                <div className="h-1.5 bg-border">
                  <div className="h-1.5 bg-primary transition-all" style={{ width: `${planPct}%` }} />
                </div>
              </div>
              <Link
                href={`/roadmap?topic=${encodeURIComponent(plan.topic)}&goal=${plan.goal}`}
                className="flex items-center gap-2 text-sm text-primary hover:underline"
              >
                {t.startPlan} <ArrowRight size={13} />
              </Link>
            </div>
          ) : (
            <Link href="/diagnostic" className="bg-surface border border-border p-5 flex items-center gap-3 hover:border-primary transition-colors">
              <Target size={16} className="text-primary" />
              <span className="text-sm font-medium text-foreground">{t.noPlan}</span>
              <span className="text-sm text-primary ml-auto flex items-center gap-1">
                {t.takeDiagnostic} <ArrowRight size={13} />
              </span>
            </Link>
          )}

          {/* Weak topics */}
          <div className="bg-surface border border-border p-5 space-y-3">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted">
              <XCircle size={12} /> {t.weak}
            </div>
            {weak.length === 0 ? (
              <p className="text-sm text-muted">{t.noWeak}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {weak.map((w, i) => {
                  const label = w.node_id.startsWith("lesson:")
                    ? w.node_id.slice(7).replace(/-/g, " ").trim()
                    : w.node_id;
                  return (
                    <span key={i} className="text-xs border border-red-200 bg-red-50 text-red-700 px-3 py-1.5" title={w.node_id}>
                      <span className="capitalize">{label}</span> · {w.errors}
                    </span>
                  );
                })}
              </div>
            )}
            {lastDiagnostic && (
              <p className="text-xs text-muted">
                {t.last}: {lastDiagnostic.subject} — {lastDiagnostic.correct}/{lastDiagnostic.total} ({Math.round((lastDiagnostic.correct / Math.max(1, lastDiagnostic.total)) * 100)}%)
              </p>
            )}
          </div>

          {/* Badges */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {badges.map((b) => (
              <div
                key={b.id}
                className={`border p-4 flex flex-col items-center gap-2 text-center ${
                  b.done ? "bg-surface border-primary/40" : "bg-surface border-border opacity-45"
                }`}
              >
                <Award size={18} className={b.done ? "text-primary" : "text-muted"} />
                <span className="text-[11px] font-medium text-foreground leading-tight">{b.label}</span>
                {!b.done && <span className="font-mono text-[9px] uppercase text-muted">{t.locked}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}