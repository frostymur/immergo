"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import UserAvatar from "@/components/UserAvatar";
import { useLocale, type Locale } from "@/components/LocaleProvider";

const LOCALES: Locale[] = ["kz", "ru", "en"];
const GOALS: { value: string; label: string }[] = [
  { value: "ent", label: "ЕНТ" },
  { value: "olympiad", label: "Олимпиада / Olympiad" },
  { value: "school", label: "Школьная программа / School program" },
];

const I18N: Record<Locale, Record<string, string>> = {
  kz: {
    title: "Баптаулар",
    language: "Тіл",
    grade: "Сынып",
    gradePh: "Мыс.: 9",
    goal: "Мақсат",
    save: "Сақтау",
    saved: "Сақталды",
    profile: "Профиль",
  },
  ru: {
    title: "Настройки",
    language: "Язык",
    grade: "Класс",
    gradePh: "Напр.: 9",
    goal: "Цель",
    save: "Сохранить",
    saved: "Сохранено",
    profile: "Профиль",
  },
  en: {
    title: "Settings",
    language: "Language",
    grade: "Grade",
    gradePh: "E.g. 9",
    goal: "Goal",
    save: "Save",
    saved: "Saved",
    profile: "Profile",
  },
};

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [grade, setGrade] = useState("");
  const [defaultGoal, setDefaultGoal] = useState("ent");
  const { locale, setLocale, t: tNav } = useLocale();
  const [message, setMessage] = useState("");
  const supabase = createClient();
  const t = I18N[locale];

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.push("/auth");
        return;
      }
      setUser(data.user);
      const { data: profile } = await supabase
        .from("profiles")
        .select("grade, default_goal")
        .eq("id", data.user.id)
        .maybeSingle();
      if (profile) {
        if (profile.grade) setGrade(profile.grade);
        if (profile.default_goal) setDefaultGoal(profile.default_goal);
      }
    });
  }, [router, supabase]);

  const save = async () => {
    setMessage("");
    if (!user) return;
    const { error } = await supabase
      .from("profiles")
      .update({ lang: locale, grade: grade || null, default_goal: defaultGoal })
      .eq("id", user.id);
    if (error) {
      setMessage(error.message);
    } else {
      setMessage(t.saved);
    }
  };

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold text-foreground">{t.title}</h1>
        <UserAvatar />
      </div>

      <div className="bg-surface border border-border p-6 space-y-6">
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted">[ {t.profile} ]</div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">{t.language}</label>
          <div className="flex gap-2 max-w-xs">
            {LOCALES.map((l) => (
              <button
                key={l}
                onClick={() => setLocale(l)}
                className={`px-4 py-2 text-sm font-semibold uppercase transition-all ${
                  locale === l ? "bg-primary text-foreground" : "bg-surface text-muted hover:bg-primary/10"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">{t.grade}</label>
          <input
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            className="w-full max-w-xs h-10 border border-border px-3 text-sm outline-none focus:border-primary"
            placeholder={t.gradePh}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">{t.goal}</label>
          <div className="flex flex-col gap-2 max-w-sm">
            {GOALS.map((g) => (
              <button
                key={g.value}
                onClick={() => setDefaultGoal(g.value)}
                className={`px-4 py-2 text-sm font-medium text-left transition-all border ${
                  defaultGoal === g.value
                    ? "bg-primary/10 border-primary text-foreground"
                    : "bg-surface border-border text-muted hover:border-primary"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={save}
          className="bg-primary hover:bg-primary-hover text-foreground px-6 py-2.5 text-sm font-medium transition-all"
        >
          {t.save}
        </button>

        {message && (
          <div className="text-sm text-green-600 bg-green-50 border border-green-200 p-3">
            {message}
          </div>
        )}
      </div>
    </div>
  );
}