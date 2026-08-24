"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2, Target, BarChart3, GraduationCap, Award } from "lucide-react";
import { useLocale, type Locale } from "@/components/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { apiDiagnosticEvaluate, apiDiagnosticStart, type DiagnosticQuestion, type DiagnosticResult, type Goal } from "@/lib/api";
import Confetti from "@/components/Confetti";

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
  review: string;
  yourAnswer: string;
  correctLabel: string;
  wrongLabel: string;
  demoNote: string;
  perfect: string;
};

const I18N: Record<Locale, Dict> = {
  kz: {
    tag: "DIAGNOSTIC",
    title: "Жылдам диагностика",
    subtitle: "Сынып пен пәнді таңдап, 15 сұраққа жауап беріңіз — барлық негізгі тақырыптар бойынша терең диагностика. Біз дайындық жоспарыңызды құрамыз.",
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
    review: "Жауаптарды талдау",
    yourAnswer: "Сіздің жауабыңыз",
    correctLabel: "Дұрыс",
    wrongLabel: "Қате",
    demoNote: "Демо-версия: 12 сынып · Физика · ЕНТ",
    perfect: "Нақты! Барлық дұрыс",
  },
  ru: {
    tag: "DIAGNOSTIC",
    title: "Быстрая диагностика",
    subtitle: "Выберите класс и предмет, ответьте на 15 вопросов — глубокая диагностика по всем основным темам. Мы составим ваш план подготовки.",
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
    review: "Разбор ответов",
    yourAnswer: "Ваш ответ",
    correctLabel: "Правильно",
    wrongLabel: "Неверно",
    demoNote: "Демо-версия: 12 класс · Физика · ЕНТ",
    perfect: "Идеально! Все ответы верны",
  },
  en: {
    tag: "DIAGNOSTIC",
    title: "Quick Diagnostic",
    subtitle: "Pick your grade and subject, answer 15 questions — a deep diagnostic across all key topics. We will build your study plan.",
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
    review: "Answer review",
    yourAnswer: "Your answer",
    correctLabel: "Correct",
    wrongLabel: "Incorrect",
    demoNote: "Demo: Grade 12 · Physics · UNT",
    perfect: "Perfect! Every answer correct",
  },
};

/** Animated score ring — sweeps from 0 to the final percentage on mount. */
function ScoreRing({ correct, total }: { correct: number; total: number }) {
  const pct = Math.round((correct / Math.max(1, total)) * 100);
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);
  const R = 52;
  const C = 2 * Math.PI * R;
  const tone = pct >= 75 ? "stroke-green-500" : pct >= 45 ? "stroke-primary" : "stroke-red-400";
  return (
    <div className="relative w-28 h-28 shrink-0">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <circle cx="60" cy="60" r={R} className="stroke-border" strokeWidth="9" fill="none" />
        <circle
          cx="60"
          cy="60"
          r={R}
          className={tone}
          strokeWidth="9"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - shown / 100)}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.22, 1, 0.36, 1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold text-foreground">
          {correct}
          <span className="text-base text-muted">/{total}</span>
        </span>
        <span className="font-mono text-[9px] uppercase tracking-widest text-muted">{pct}%</span>
      </div>
    </div>
  );
}

async function loadDemoQuestions(lang: Locale): Promise<DiagnosticQuestion[]> {
  const res = await fetch(`/demo/diagnostic-${lang}.json`);
  if (!res.ok) throw new Error("no demo data");
  const data = await res.json();
  return Array.isArray(data) ? data : data.questions || [];
}

export default function DiagnosticPage() {
  const router = useRouter();
  const { locale } = useLocale();
  const t = I18N[locale];

  const [step, setStep] = useState<"setup" | "test" | "result">("setup");
  // Demo build: the diagnostic is locked to one configuration —
  // 12-й класс, Физика, цель ЕНТ. Other configs stay placeholders.
  const grade = 12;
  const demoSubject = t.subjects[1];
  const goal: Goal = "ent";

  const [questions, setQuestions] = useState<DiagnosticQuestion[]>([]);
  const [answers, setAnswers] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [celebrate, setCelebrate] = useState(0);

  const startTest = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiDiagnosticStart(grade, demoSubject, goal, locale);
      setQuestions(data.questions);
      setAnswers(new Array(data.questions.length).fill(-1));
      setStep("test");
    } catch {
      try {
        const demo = await loadDemoQuestions(locale);
        setQuestions(demo);
        setAnswers(new Array(demo.length).fill(-1));
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
    let final: DiagnosticResult;
    try {
      final = await apiDiagnosticEvaluate(grade, demoSubject, goal, locale, questions, answers);
    } catch {
      const correct = questions.reduce((acc, q, i) => (answers[i] === q.answer ? acc + 1 : acc), 0);
      const pct = correct / Math.max(1, questions.length);
      final = {
        correct,
        total: questions.length,
        level: pct >= 0.75 ? "advanced" : pct >= 0.45 ? "intermediate" : "beginner",
        feedback: "",
        weak_topics: questions
          .map((q, i) => (answers[i] === q.answer ? "" : q.topic || q.q))
          .filter(Boolean)
          .slice(0, 6),
        recommendation: `${demoSubject}: ${locale === "kz" ? "тақырыптың негіздерінен бастаңыз" : locale === "ru" ? "начните с основ темы" : "start with the fundamentals of the topic"}.`,
      };
    }
    setResult(final);
    setLoading(false);
    setStep("result");
    if (final.correct / Math.max(1, final.total) >= 0.4) setCelebrate((c) => c + 1);

    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      // Per-question answers feed the teacher's class-level topic analytics.
      const answerDetail = questions.map((q, i) => ({
        topic: q.topic || q.q,
        correct: answers[i] === q.answer,
      }));
      await supabase.from("diagnostic_results").insert({
        user_id: userData.user.id,
        subject: demoSubject,
        grade,
        goal,
        correct: final.correct,
        total: final.total,
        level: final.level,
        feedback: final.feedback,
        weak_topics: final.weak_topics,
        recommendation: final.recommendation,
        answers: answerDetail,
      });
    }
  };

  const progress = Math.round((answers.filter((a) => a >= 0).length / Math.max(1, questions.length)) * 100);

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <header className="border-b border-border bg-surface">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] uppercase tracking-widest text-primary border border-primary/30 px-2 py-1">
              [ IMMERGO_CANVAS: {t.tag} ]
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
              <p className="text-[11px] font-mono uppercase tracking-wider text-muted border border-border bg-surface inline-block px-2.5 py-1">
                {t.demoNote}
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <GraduationCap size={15} className="text-primary" /> {t.classLabel}
              </div>
              <div className="grid grid-cols-6 gap-2">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => (
                  <button
                    key={g}
                    disabled={g !== grade}
                    className={`py-2.5 text-sm font-medium border transition-all disabled:cursor-not-allowed ${
                      grade === g
                        ? "bg-primary text-foreground border-primary"
                        : "bg-surface text-muted border-border disabled:opacity-40"
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
                    disabled={s !== demoSubject}
                    className={`py-2.5 text-sm font-medium border transition-all disabled:cursor-not-allowed ${
                      demoSubject === s
                        ? "bg-primary text-foreground border-primary"
                        : "bg-surface text-muted border-border disabled:opacity-40"
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
                    disabled={g.id !== goal}
                    className={`py-3 px-4 text-sm font-medium border transition-all text-left disabled:cursor-not-allowed ${
                      goal === g.id
                        ? "bg-primary text-foreground border-primary"
                        : "bg-surface text-muted border-border disabled:opacity-40"
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
              disabled={loading}
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
              <h1 className="text-xl font-semibold text-foreground">{demoSubject}</h1>
              <div className="flex items-center gap-3 text-xs text-muted">
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
            </div>

            <div className="bg-surface border border-border p-8 flex flex-col sm:flex-row items-center gap-8">
              <ScoreRing correct={result.correct} total={result.total} />
              <div className="space-y-2 text-center sm:text-left">
                <div className="inline-block animate-pop-in border border-primary/40 bg-primary/10 text-primary px-3 py-1 font-mono text-[10px] uppercase tracking-widest">
                  {t.level[result.level]}
                </div>
                {result.correct === result.total && (
                  <div className="inline-block animate-pop-in border border-green-400 bg-green-50 text-green-700 px-3 py-1 font-mono text-[10px] uppercase tracking-widest">
                    ★ {t.perfect}
                  </div>
                )}
                <p className="text-sm text-foreground leading-relaxed">{result.feedback || "—"}</p>
              </div>
            </div>
            <Confetti burst={celebrate} count={result.correct === result.total ? 180 : 90} />

            <div className="bg-surface border border-border p-5 space-y-3">
              <p className="text-sm font-medium text-foreground">{t.review}</p>
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {questions.map((q, i) => {
                  const isCorrect = answers[i] === q.answer;
                  return (
                    <div
                      key={i}
                      className={`border p-3 ${isCorrect ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50"}`}
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className={`flex-shrink-0 mt-0.5 font-mono text-[9px] uppercase tracking-wider border px-1.5 py-0.5 ${
                            isCorrect ? "border-green-300 text-green-700" : "border-red-300 text-red-600"
                          }`}
                        >
                          {isCorrect ? t.correctLabel : t.wrongLabel}
                        </span>
                        <div className="min-w-0 space-y-1">
                          <p className="text-sm text-foreground leading-snug">{q.q}</p>
                          <p className="text-xs text-muted">
                            {t.yourAnswer}: {q.options[answers[i]] ?? "—"}
                            {!isCorrect && ` · ${q.options[q.answer]}`}
                          </p>
                          {q.explain && <p className="text-xs text-muted leading-snug">{q.explain}</p>}
                        </div>
                      </div>
                    </div>
                  );
                })}
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
                onClick={() => {
                  const weak = result.weak_topics.join(",");
                  router.push(
                    `/roadmap?topic=${encodeURIComponent(demoSubject)}&goal=${goal}&level=${result.level}&weak=${encodeURIComponent(weak)}`
                  );
                }}
                className="flex items-center justify-center gap-2 px-5 py-3 bg-primary hover:bg-primary-hover text-foreground text-sm font-medium transition-all"
              >
                <Target size={15} /> {t.roadmap}
              </button>
              <button
                onClick={() => router.push(`/workspace?topic=${encodeURIComponent(`${demoSubject} — ${goal}`)}&level=${result.level}`)}
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