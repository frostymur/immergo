"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2, Target, Clock } from "lucide-react";
import { useLocale, type Locale } from "@/components/LocaleProvider";
import { apiRoadmap, type Goal } from "@/lib/api";

const I18N: Record<Locale, Record<string, string>> = {
  kz: {
    tag: "ROADMAP",
    title: "Дайындық жоспары",
    subtitle: "Мақсатыңызға апаратын қадамдар. Әр қадамнан сабақ бастай аласыз.",
    study: "Оқу",
    fullLesson: "Толық сабақты бастау",
    back: "Артқа",
    loading: "Жоспар құрылуда…",
    demo: "ДЕМО ЖОСПАР",
  },
  ru: {
    tag: "ROADMAP",
    title: "План подготовки",
    subtitle: "Шаги к вашей цели. С любого шага можно начать урок.",
    study: "Изучить",
    fullLesson: "Начать полный урок",
    back: "Назад",
    loading: "Строим план…",
    demo: "ДЕМО-ПЛАН",
  },
  en: {
    tag: "ROADMAP",
    title: "Study Roadmap",
    subtitle: "Steps toward your goal. You can start a lesson from any step.",
    study: "Study",
    fullLesson: "Start full lesson",
    back: "Back",
    loading: "Building roadmap…",
    demo: "DEMO ROADMAP",
  },
};

type Step = { title: string; detail: string; duration?: string };

async function loadDemoRoadmap(lang: Locale): Promise<Step[]> {
  const res = await fetch(`/demo/roadmap-${lang}.json`);
  if (!res.ok) throw new Error("no demo data");
  const data = await res.json();
  return data.steps as Step[];
}

export default function RoadmapPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale } = useLocale();
  const t = I18N[locale];

  const topic = searchParams.get("topic") || "Physics";
  const goal = (searchParams.get("goal") || "ent") as Goal;

  const [steps, setSteps] = useState<Step[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await apiRoadmap(topic, goal, locale);
        if (!cancelled) {
          setSteps(data.steps);
          setDemo(false);
        }
      } catch {
        try {
          const demoSteps = await loadDemoRoadmap(locale);
          if (!cancelled) {
            setSteps(demoSteps);
            setDemo(true);
          }
        } catch {
          if (!cancelled) setSteps([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [topic, goal, locale]);

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <header className="border-b border-border bg-surface">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] uppercase tracking-widest text-primary border border-primary/30 px-2 py-1">
              [ LUMI_CANVAS: {t.tag} ]
            </span>
            <span className="text-sm text-foreground">{topic}</span>
          </div>
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors"
          >
            <ArrowLeft size={14} /> {t.back}
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-10">
        <div className="space-y-2 mb-10">
          <h1 className="text-2xl font-semibold text-foreground">{t.title}</h1>
          <p className="text-sm text-muted">{t.subtitle}</p>
          {demo && (
            <span className="inline-block font-mono text-[10px] uppercase tracking-widest border border-border px-2 py-1 mt-2">
              {t.demo}
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center gap-3 text-sm text-muted py-16 justify-center">
            <Loader2 size={16} className="animate-spin" /> {t.loading}
          </div>
        ) : (
          <div className="space-y-0">
            {steps && steps.length > 0 ? (
              steps.map((s, i) => (
                <div key={i} className="relative flex gap-5">
                  {i < steps.length - 1 && (
                    <div className="absolute left-[15px] top-10 bottom-0 w-px bg-border" />
                  )}
                  <div className="relative shrink-0">
                    <div
                      className={`w-8 h-8 flex items-center justify-center border font-mono text-xs ${
                        i === 0
                          ? "bg-primary text-foreground border-primary"
                          : "bg-surface text-foreground border-border"
                      }`}
                    >
                      {i + 1}
                    </div>
                  </div>
                  <div className="flex-1 pb-8">
                    <div className="bg-surface border border-border p-5">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <h3 className="text-sm font-semibold text-foreground leading-snug">{s.title}</h3>
                        {s.duration && (
                          <span className="flex items-center gap-1.5 shrink-0 font-mono text-[10px] text-muted border border-border px-2 py-1">
                            <Clock size={11} /> {s.duration}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted leading-relaxed mb-4">{s.detail}</p>
                      <button
                        onClick={() => router.push(`/workspace?topic=${encodeURIComponent(s.title)}`)}
                        className="flex items-center gap-2 px-4 py-2 border border-primary text-primary hover:bg-primary/10 text-sm font-medium transition-all"
                      >
                        <Target size={13} /> {t.study}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted">—</p>
            )}

            {steps && steps.length > 0 && (
              <button
                onClick={() => router.push(`/workspace?topic=${encodeURIComponent(topic)}`)}
                className="flex items-center justify-center gap-2 w-full px-5 py-3.5 bg-primary hover:bg-primary-hover text-foreground text-sm font-medium transition-all"
              >
                <ArrowRight size={15} /> {t.fullLesson}
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}