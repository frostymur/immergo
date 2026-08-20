"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2, Target, BarChart3, GraduationCap, Award } from "lucide-react";
import { useLocale, type Locale } from "@/components/LocaleProvider";
import { apiDiagnosticEvaluate, apiDiagnosticStart, type DiagnosticQuestion, type DiagnosticResult, type Goal } from "@/lib/api";

type Dict = {
  tag: string;
  title: string;
  subtitle: string;
  classLabel: string;
  subjectLabel: string;
  goalLabel: string;
  subjects: string[];
  goals: { id: string; label: string }[];
  start: string;
  qLabel: string;
  next: string;
  prev: string;
  finish: string;
  loading: string;
  score: string;
  of: string;
  level: Record<string, string>;
  weak: string;
  rec: string;
  roadmap: string;
  lesson: string;
  again: string;
};

const I18N: Record<Locale, Dict> = {
  kz: {
    tag: "DIAGNOSTIC",
    title: "Жылдам диагностика",
    subtitle: "Сынып пен пәнді таңдап, 5 сұраққа жауап беріңіз. Біз дайындық жоспарыңызды құрамыз.",
    classLabel: "Сынып",
    subjectLabel: "Пән",
    goalLabel: "Мақсат",
    subjects: ["Математика", "Физика", "Химия", "Биология", "Информатика", "География"],
    goals: [
      { id: "ent", label: "ЕНТ" },
      { id: "olympiad", label: "Олимпиада" },
      { id: "school", label: "Мектеп бағдарламасы" },
    ],
    start: "Тестті бастау",
    qLabel: "сұрақ",
    next: "Келесі",
    prev: "Артқа",
    finish: "Нәтижені көру",
    loading: "Сұрақтар дайындалуда…",
    score: "Нәтиже",
    of: "дұрыс жауап",
    level: { beginner: "Бастауыш", intermediate: "Орташа", advanced: "Жоғары" } as Record<string, string>,
    weak: "Назар аудару керек тақырыптар",
    rec: "Ұсыныс",
    roadmap: "Дайындық жоспарын ашу",
    lesson: "Сабақты бастау",
    again: "Қайта тапсыру",
  },
  ru: {
    tag: "DIAGNOSTIC",
    title: "Быстрая диагностика",
    subtitle: "Выберите класс и предмет, ответьте на 5 вопросов. Мы составим ваш план подготовки.",
    classLabel: "Класс",
    subjectLabel: "Предмет",
    goalLabel: "Цель",
    subjects: ["Математика", "Физика", "Химия", "Биология", "Информатика", "География"],
    goals: [
      { id: "ent", label: "ЕНТ" },
      { id: "olympiad", label: "Олимпиада" },
      { id: "school", label: "Школьная программа" },
    ],
    start: "Начать тест",
    qLabel: "вопрос",
    next: "Далее",
    prev: "Назад",
    finish: "Показать результат",
    loading: "Готовим вопросы…",
    score: "Результат",
    of: "правильных ответов",
    level: { beginner: "Начальный", intermediate: "Средний", advanced: "Высокий" } as Record<string, string>,
    weak: "Темы, требующие внимания",
    rec: "Рекомендация",
    roadmap: "Открыть план подготовки",
    lesson: "Начать урок",
    again: "Пройти снова",
  },
  en: {
    tag: "DIAGNOSTIC",
    title: "Quick Diagnostic",
    subtitle: "Pick your grade and subject, answer 5 questions. We will build your study plan.",
    classLabel: "Grade",
    subjectLabel: "Subject",
    goalLabel: "Goal",
    subjects: ["Math", "Physics", "Chemistry", "Biology", "Computer Science", "Geography"],
    goals: [
      { id: "ent", label: "UNT" },
      { id: "olympiad", label: "Olympiad" },
      { id: "school", label: "School program" },
    ],
    start: "Start test",
    qLabel: "question",
    next: "Next",
    prev: "Back",
    finish: "Show result",
    loading: "Preparing questions…",
    score: "Result",
    of: "correct answers",
    level: { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" } as Record<string, string>,
    weak: "Topics to focus on",
    rec: "Recommendation",
    roadmap: "Open study plan",
    lesson: "Start lesson",
    again: "Retake test",
  },
};

async function loadDemoQuestions(lang: Locale): Promise<DiagnosticQuestion[]> {
  const res = await fetch(`/demo/diagnostic-${lang}.json`);
  if (!res.ok) throw new Error("no demo data");
  return res.json();
}

export default function DiagnosticPage() {
  const router = useRouter();
  const { locale } = useLocale();
  const t = I18N[locale];

  const [step, setStep] = useState<"setup" | "test" | "result">("setup");
  const [grade, setGrade] = useState(9);
  const [subject, setSubject] = useState("");
  const [goal, setGoal] = useState<Goal>("ent");

  const [questions, setQuestions] = useState<DiagnosticQuestion[]>([]);
  const [answers, setAnswers] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [demoMode, setDemoMode] = useState(false);

  const [result, setResult] = useState<DiagnosticResult | null>(null);

  const startTest = async () => {
    if (!subject) {
      setError(t.subjects.length ? "choose" : "");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await apiDiagnosticStart(grade, subject, goal, locale);
      setQuestions(data.questions);
      setAnswers(new Array(data.questions.length).fill(-1));
      setStep("test");
    } catch {
      try {
        const demo = await loadDemoQuestions(locale);
        setQuestions(demo);
        setAnswers(new Array(demo.length).fill(-1));
        setDemoMode(true);
        setStep("test");
      } catch {
        setError("demo-error");
      }
    } finally {
      setLoading(false);
    }
  };

  const finishTest = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiDiagnosticEvaluate(grade, subject, goal, locale, questions, answers);
      setResult(data);
    } catch {
      const correct = questions.reduce((acc, q, i) => (answers[i] === q.answer ? acc + 1 : acc), 0);
      setResult({
        correct,
        total: questions.length,
        level: correct >= 4 ? "advanced" : correct >= 2 ? "intermediate" : "beginner",
        feedback: demoMode
          ? "Demo mode — live AI evaluation is unavailable, showing sample analysis."
          : "Evaluation failed — showing score only.",
        weak_topics: questions
          .map((q, i) => (answers[i] === q.answer ? "" : q.q))
          .filter(Boolean)
          .slice(0, 4),
        recommendation: `${subject}: ${locale === "kz" ? "тақырыптың негіздерінен бастаңыз" : locale === "ru" ? "начните с основ темы" : "start with the fundamentals of the topic"}.`,
      });
    } finally {
      setLoading(false);
      setStep("result");
    }
  };

  const progress = Math.round((answers.filter((a) => a >= 0).length / Math.max(1, questions.length)) * 100);

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <header className="border-b border-border bg-surface">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] uppercase tracking-widest text-primary border border-primary/30 px-2 py-1">
              [ LUMI_CANVAS: {t.tag} ]
            </span>
          </div>
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors"
          >
            <ArrowLeft size={14} /> Home
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-10">
        {step === "setup" && (
          <div className="space-y-8">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold text-foreground">{t.title}</h1>
              <p className="text-sm text-muted">{t.subtitle}</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <GraduationCap size={15} className="text-primary" /> {t.classLabel}
              </div>
              <div className="grid grid-cols-6 gap-2">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => (
                  <button
                    key={g}
                    onClick={() => setGrade(g)}
                    className={`py-2.5 text-sm font-medium border transition-all ${
                      grade === g
                        ? "bg-primary text-foreground border-primary"
                        : "bg-surface text-muted border-border hover:border-primary hover:text-foreground"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Target size={15} className="text-primary" /> {t.subjectLabel}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {t.subjects.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSubject(s)}
                    className={`py-2.5 text-sm font-medium border transition-all ${
                      subject === s
                        ? "bg-primary text-foreground border-primary"
                        : "bg-surface text-muted border-border hover:border-primary hover:text-foreground"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <BarChart3 size={15} className="text-primary" /> {t.goalLabel}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {t.goals.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setGoal(g.id as Goal)}
                    className={`py-3 px-4 text-sm font-medium border transition-all text-left ${
                      goal === g.id
                        ? "bg-primary text-foreground border-primary"
                        : "bg-surface text-muted border-border hover:border-primary hover:text-foreground"
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 p-3">{error}</p>}

            <button
              onClick={startTest}
              disabled={loading || !subject}
              className="flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-3 bg-primary hover:bg-primary-hover text-foreground text-sm font-medium transition-all disabled:opacity-40"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
              {t.start}
            </button>
          </div>
        )}

        {step === "test" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-semibold text-foreground">{subject}</h1>
              <div className="flex items-center gap-3 text-xs text-muted">
                {demoMode && (
                  <span className="font-mono text-[10px] uppercase tracking-widest border border-border px-2 py-1">
                    DEMO MODE
                  </span>
                )}
                <span>
                  {answers.filter((a) => a >= 0).length}/{questions.length} {t.qLabel}
                </span>
              </div>
            </div>
            <div className="h-1 bg-border">
              <div className="h-1 bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>

            {questions.map((q, qi) => (
              <div key={qi} className="bg-surface border border-border p-5 space-y-4">
                <p className="text-sm font-medium text-foreground leading-relaxed">
                  <span className="font-mono text-[10px] text-muted mr-2">{qi + 1}.</span>
                  {q.q}
                </p>
                <div className="grid gap-2">
                  {q.options.map((opt, oi) => (
                    <button
                      key={oi}
                      onClick={() =>
                        setAnswers((prev) => prev.map((a, i) => (i === qi ? oi : a)))
                      }
                      className={`text-left px-4 py-2.5 text-sm border transition-all ${
                        answers[qi] === oi
                          ? "bg-primary text-foreground border-primary"
                          : "bg-surface text-foreground border-border hover:border-primary"
                      }`}
                    >
                      <span className="font-mono text-[10px] text-muted mr-2">{String.fromCharCode(65 + oi)}</span>
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <div className="flex items-center justify-between">
              <button
                onClick={() => setStep("setup")}
                className="flex items-center gap-2 px-5 py-2.5 border border-border text-sm text-muted hover:text-foreground transition-colors"
              >
                <ArrowLeft size={14} /> {t.prev}
              </button>
              <button
                onClick={finishTest}
                disabled={loading || answers.some((a) => a < 0)}
                className="flex items-center gap-2 px-8 py-2.5 bg-primary hover:bg-primary-hover text-foreground text-sm font-medium transition-all disabled:opacity-40"
              >
                {loading ? <Loader2 size={15} className="animate-spin" /> : <Award size={15} />}
                {t.finish}
              </button>
            </div>
          </div>
        )}

        {step === "result" && result && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-semibold text-foreground">{t.score}</h1>
              {demoMode && (
                <span className="font-mono text-[10px] uppercase tracking-widest border border-border px-2 py-1">
                  DEMO MODE
                </span>
              )}
            </div>

            <div className="bg-surface border border-border p-8 flex flex-col sm:flex-row items-center gap-8">
              <div className="w-28 h-28 rounded-full border-4 border-primary flex items-center justify-center shrink-0">
                <div className="text-center">
                  <div className="text-3xl font-semibold text-foreground">
                    {result.correct}/{result.total}
                  </div>
                  <div className="font-mono text-[9px] uppercase tracking-widest text-muted">{t.of}</div>
                </div>
              </div>
              <div className="space-y-2 text-center sm:text-left">
                <div className="inline-block border border-primary/40 bg-primary/10 text-primary px-3 py-1 font-mono text-[10px] uppercase tracking-widest">
                  {t.level[result.level]}
                </div>
                <p className="text-sm text-foreground leading-relaxed">{result.feedback || "—"}</p>
              </div>
            </div>

            {result.weak_topics.length > 0 && (
              <div className="bg-surface border border-border p-5 space-y-3">
                <p className="text-sm font-medium text-foreground">{t.weak}</p>
                <div className="flex flex-wrap gap-2">
                  {result.weak_topics.map((w, i) => (
                    <span key={i} className="text-xs border border-border px-3 py-1.5 text-muted">
                      {w}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {result.recommendation && (
              <div className="bg-surface border border-border p-5 space-y-2">
                <p className="text-sm font-medium text-foreground">{t.rec}</p>
                <p className="text-sm text-muted leading-relaxed">{result.recommendation}</p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                onClick={() => router.push(`/roadmap?topic=${encodeURIComponent(subject)}&goal=${goal}`)}
                className="flex items-center justify-center gap-2 px-5 py-3 bg-primary hover:bg-primary-hover text-foreground text-sm font-medium transition-all"
              >
                <Target size={15} /> {t.roadmap}
              </button>
              <button
                onClick={() => router.push(`/workspace?topic=${encodeURIComponent(`${subject} — ${goal}`)}`)}
                className="flex items-center justify-center gap-2 px-5 py-3 border border-primary text-primary hover:bg-primary/10 text-sm font-medium transition-all"
              >
                <ArrowRight size={15} /> {t.lesson}
              </button>
              <button
                onClick={() => {
                  setStep("setup");
                  setResult(null);
                  setQuestions([]);
                  setAnswers([]);
                }}
                className="flex items-center justify-center gap-2 px-5 py-3 border border-border text-muted hover:text-foreground text-sm font-medium transition-all"
              >
                {t.again}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}