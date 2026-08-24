"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import UserAvatar from "@/components/UserAvatar";
import { useLocale, type Locale } from "@/components/LocaleProvider";
import { fetchTtsAudio, fetchTtsVoices, type TtsVoice } from "@/lib/api";
import { getSelectedVoice, setSelectedVoice } from "@/lib/voices";
import { Loader2, Pause, Play } from "lucide-react";

const LOCALES: Locale[] = ["kz", "ru", "en"];
const GOALS: { value: string; label: string }[] = [
  { value: "ent", label: "ЕНТ" },
  { value: "olympiad", label: "Олимпиада / Olympiad" },
  { value: "school", label: "Школьная программа / School program" },
];

const VOICE_PREVIEW: Record<Locale, string> = {
  kz: "Сәлем! Мен сенің жеке оқытушыңмын. Бүгін бірге оқимыз.",
  ru: "Привет! Я твой личный репетитор. Сегодня позанимаемся вместе.",
  en: "Hi! I'm your personal tutor. Let's learn something today.",
};

const I18N: Record<Locale, Record<string, string>> = {
  kz: {
    title: "Баптаулар",
    language: "Тіл",
    grade: "Сынып",
    gradePh: "Мыс.: 9",
    goal: "Мақсат",
    voice: "Дауыс",
    voiceHint: "Әр тілге дауысты таңдаңыз — сабақта ол осылай сөйлейді.",
    female: "әйел",
    male: "ер",
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
    voice: "Голос",
    voiceHint: "Выберите голос для каждого языка — так Immergo будет говорить на уроке.",
    female: "женский",
    male: "мужской",
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
    voice: "Voice",
    voiceHint: "Pick a voice for each language — Immergo will speak it in lessons.",
    female: "female",
    male: "male",
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

  // Voice selection (per language)
  const [voices, setVoices] = useState<Record<Locale, TtsVoice[]> | null>(null);
  const [voiceSel, setVoiceSel] = useState<Record<Locale, string>>({ kz: "", ru: "", en: "" });
  const [playing, setPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setVoices(await fetchTtsVoices());
      } catch {
        setVoices({} as Record<Locale, TtsVoice[]>);
      }
      const sel = {} as Record<Locale, string>;
      for (const l of LOCALES) sel[l] = getSelectedVoice(l) || "";
      setVoiceSel(sel);
    })();
  }, []);

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

  const pickVoice = (l: Locale, id: string) => {
    setVoiceSel((s) => ({ ...s, [l]: id }));
    setSelectedVoice(l, id);
  };

  const preview = async (l: Locale, id: string) => {
    if (playing === id) {
      audioRef.current?.pause();
      setPlaying(null);
      return;
    }
    try {
      const blob = await fetchTtsAudio(VOICE_PREVIEW[l], l, id);
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      setPlaying(id);
      audio.onended = () => {
        setPlaying(null);
        URL.revokeObjectURL(url);
      };
      await audio.play();
    } catch {
      setPlaying(null);
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

        {/* Voice picker — per language */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">{t.voice}</label>
          <p className="text-xs text-muted mb-3">{t.voiceHint}</p>
          <div className="space-y-4">
            {LOCALES.map((l) => (
              <div key={l}>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted mb-2">{l.toUpperCase()}</div>
                {!voices ? (
                  <div className="flex items-center gap-2 text-sm text-muted py-2">
                    <Loader2 size={14} className="animate-spin" /> …
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(voices[l] || []).map((v) => {
                      const active = voiceSel[l] === v.id;
                      const isPlaying = playing === v.id;
                      return (
                        <div
                          key={v.id}
                          onClick={() => pickVoice(l, v.id)}
                          className={`flex items-center gap-3 border p-2.5 cursor-pointer transition-colors ${
                            active ? "border-primary bg-primary/5" : "border-border bg-surface hover:border-primary/50"
                          }`}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              preview(l, v.id);
                            }}
                            className="w-8 h-8 flex items-center justify-center border border-border text-foreground hover:border-primary transition-colors"
                            aria-label={`Preview ${v.name}`}
                          >
                            {isPlaying ? <Pause size={13} /> : <Play size={13} />}
                          </button>
                          <span className="text-sm font-medium flex-1 min-w-0 truncate">{v.name}</span>
                          <span className="font-mono text-[10px] uppercase tracking-widest text-muted shrink-0">
                            {v.gender === "Female" ? t.female : v.gender === "Male" ? t.male : ""}
                          </span>
                          {active && (
                            <span className="font-mono text-[10px] uppercase tracking-widest text-primary shrink-0">
                              ✓
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
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