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
    aboutYouTitle: "Өзіңіз туралы",
    aboutYouDesc: "Immergo сізді қалай оқыту керектігін білуі үшін. Барлығы міндетті емес, кез келген уақытта өзгертуге немесе өшіруге болады.",
    yourName: "Атыңыз",
    yourNameHint: "Immergo сізді қалай атауы керек.",
    whatStudying: "Не оқып жатырсыз",
    whatStudyingHint: "Өз сөзіңізбен — «9-сынып биология», «ҰБТ-ға дайындық».",
    voice: "Дауыс",
    voiceHint: "Әр тілге дауысты таңдаңыз — сабақта ол осылай сөйлейді.",
    female: "әйел",
    male: "ер",
    save: "Сақтау",
    saved: "Сақталды",
    profile: "Профиль",
    lumiTitle: "Immergo",
    examDeadline: "Емтихан немесе дедлайн",
    examDeadlineHint: "Immergo басымдықтарды білуі үшін. Мерзімі өткеннен кейін өшіріңіз.",
    thingsInto: "Қызығушылықтарыңыз",
    thingsIntoHint: "Ыңғайлы кезде аналогиялар үшін қолданылады.",
    workingTowards: "Сіздің мақсатыңыз",
    workingTowardsHint: "Баға, қиын тақырып немесе сұхбат — нақты немен жұмыс істеп жатқаныңыз.",
    helpsLearn: "Оқуға не көмектеседі",
    helpsLearnHint: "Immergo мұны ескереді, бірақ сабақта ешқашан айтпайды. Қаламасаңыз, бос қалдырыңыз.",
    alwaysDo: "Immergo әрқашан не істеуі керек",
    alwaysDoHint: "Өз сөзіңізбен — «әрқашан шешімді көрсет», «түсінікті ме деп сұрама», «аналогияларсыз». Әр сабақта осы ережелер ескеріледі."
  },
  ru: {
    title: "Настройки",
    language: "Язык",
    grade: "Класс",
    gradePh: "Напр.: 9",
    aboutYouTitle: "О вас",
    aboutYouDesc: "Что Immergo знает о том, как вас учить. Все это необязательно, вы можете изменить или удалить данные в любой момент.",
    yourName: "Ваше имя",
    yourNameHint: "Как Immergo должен(на) к вам обращаться.",
    whatStudying: "Что вы изучаете",
    whatStudyingHint: "Своими словами — «биология 9 класс», «подготовка к ЕНТ».",
    voice: "Голос",
    voiceHint: "Выберите голос для каждого языка — так Immergo будет говорить на уроке.",
    female: "женский",
    male: "мужской",
    save: "Сохранить",
    saved: "Сохранено",
    profile: "Профиль",
    lumiTitle: "Immergo",
    examDeadline: "Экзамен или дедлайн",
    examDeadlineHint: "Чтобы Immergo знал(а) приоритеты. Удалите, когда дедлайн пройдет.",
    thingsInto: "Чем вы увлекаетесь",
    thingsIntoHint: "Будет использоваться для аналогий там, где это уместно.",
    workingTowards: "К чему вы стремитесь",
    workingTowardsHint: "Оценка, сложная тема, собеседование — всё, над чем вы работаете.",
    helpsLearn: "Что помогает вам учиться",
    helpsLearnHint: "Immergo незаметно подстроится под это. Оставьте пустым, если не хотите указывать.",
    alwaysDo: "Что Immergo должен(на) делать всегда",
    alwaysDoHint: "Своими словами — «всегда показывай решение», «не спрашивай, понятно ли мне», «никаких аналогий». Применяется к каждому уроку."
  },
  en: {
    title: "Settings",
    language: "Language",
    grade: "Grade",
    gradePh: "E.g. 9",
    aboutYouTitle: "About you",
    aboutYouDesc: "What Immergo knows about how to teach you. All of it is optional, and you can change or clear any of it whenever you like.",
    yourName: "Your name",
    yourNameHint: "What Immergo calls you.",
    whatStudying: "What you're studying",
    whatStudyingHint: "In your own words — \"A level Biology\", \"first-year stats\".",
    voice: "Immergo's voice",
    voiceHint: "Have a listen, then pick the one you'd rather be taught by. A change applies to your next lesson.",
    female: "female",
    male: "male",
    save: "Save changes",
    saved: "Saved",
    profile: "Profile",
    lumiTitle: "Immergo",
    examDeadline: "Exam or deadline",
    examDeadlineHint: "So Immergo knows what to prioritise. Clear it once it's passed.",
    thingsInto: "Things you're into",
    thingsIntoHint: "Used for analogies, when one genuinely fits.",
    workingTowards: "What you're working towards",
    workingTowardsHint: "A grade, a topic you keep losing marks on, an interview — whatever it actually is.",
    helpsLearn: "Anything that helps you learn",
    helpsLearnHint: "Immergo accommodates this quietly and never brings it up in a lesson. Leave it blank if you'd rather not say.",
    alwaysDo: "Anything you want Immergo to always do",
    alwaysDoHint: "In your own words — \"always show the working\", \"stop asking if I'm following\", \"no analogies\". It is read at the start of every lesson and takes precedence over the answers above."
  },
};

const ENGLISH_ACCENTS = [
  { id: "gb", label: "British", desc: "British English" },
  { id: "us", label: "American", desc: "American English" },
  { id: "au", label: "Australian", desc: "Australian English" },
];

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [grade, setGrade] = useState("");
  const [fullName, setFullName] = useState("");
  const [studying, setStudying] = useState("");
  const { locale, setLocale, t: tNav } = useLocale();
  const [message, setMessage] = useState("");
  const supabase = createClient();
  const t = I18N[locale];

  // AI Customization fields
  const [deadline, setDeadline] = useState("");
  const [interests, setInterests] = useState("");
  const [goalText, setGoalText] = useState("");
  const [learningAccommodations, setLearningAccommodations] = useState("");
  const [customInstructions, setCustomInstructions] = useState("");

  // Voice selection (per language)
  const [voices, setVoices] = useState<Record<Locale, TtsVoice[]> | null>(null);
  const [voiceSel, setVoiceSel] = useState<Record<Locale, string>>({ kz: "", ru: "", en: "" });
  const [playing, setPlaying] = useState<string | null>(null);
  const [enAccent, setEnAccent] = useState("gb");
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
        .select("grade, full_name, studying, deadline, interests, goal_text, learning_accommodations, custom_instructions")
        .eq("id", data.user.id)
        .maybeSingle();
      if (profile) {
        if (profile.grade) setGrade(profile.grade);
        if (profile.full_name) setFullName(profile.full_name);
        if (profile.studying) setStudying(profile.studying);
        if (profile.deadline) setDeadline(profile.deadline);
        if (profile.interests) setInterests(profile.interests);
        if (profile.goal_text) setGoalText(profile.goal_text);
        if (profile.learning_accommodations) setLearningAccommodations(profile.learning_accommodations);
        if (profile.custom_instructions) setCustomInstructions(profile.custom_instructions);
      }
    });
  }, [router, supabase]);

  const save = async () => {
    setMessage("");
    if (!user) return;
    const { error } = await supabase
      .from("profiles")
      .update({ 
        lang: locale, 
        grade: grade || null,
        full_name: fullName || null,
        studying: studying || null,
        deadline: deadline || null,
        interests: interests || null,
        goal_text: goalText || null,
        learning_accommodations: learningAccommodations || null,
        custom_instructions: customInstructions || null
      })
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

        <div className="pt-6 border-t border-border">
          <h2 className="text-2xl font-bold text-foreground mb-1">{t.aboutYouTitle}</h2>
          <p className="text-sm text-muted mb-6">{t.aboutYouDesc}</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-foreground mb-1">{t.yourName}</label>
              <p className="text-sm text-muted mb-3">{t.yourNameHint}</p>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Aidyn Isataev"
                className="w-full h-11 border border-border rounded-xl px-4 text-foreground outline-none focus:border-[#5e4368] transition-colors bg-surface"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-foreground mb-1">{t.whatStudying}</label>
              <p className="text-sm text-muted mb-3">{t.whatStudyingHint}</p>
              <input
                type="text"
                value={studying}
                onChange={(e) => setStudying(e.target.value)}
                className="w-full h-11 border border-border rounded-xl px-4 text-foreground outline-none focus:border-[#5e4368] transition-colors bg-surface"
              />
            </div>
          </div>
        </div>

        {/* AI Customization fields */}
        <div className="pt-6 border-t border-border">
          <h2 className="text-2xl font-bold text-foreground mb-6">{t.lumiTitle}</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-bold text-foreground mb-1">{t.examDeadline}</label>
              <p className="text-sm text-muted mb-3">{t.examDeadlineHint}</p>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full h-11 border border-border rounded-xl px-4 text-foreground outline-none focus:border-[#5e4368] transition-colors bg-surface"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-foreground mb-1">{t.thingsInto}</label>
              <p className="text-sm text-muted mb-3">{t.thingsIntoHint}</p>
              <input
                type="text"
                value={interests}
                onChange={(e) => setInterests(e.target.value)}
                className="w-full h-11 border border-border rounded-xl px-4 text-foreground outline-none focus:border-[#5e4368] transition-colors bg-surface"
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-bold text-foreground mb-1">{t.workingTowards}</label>
            <p className="text-sm text-muted mb-3">{t.workingTowardsHint}</p>
            <textarea
              value={goalText}
              onChange={(e) => setGoalText(e.target.value)}
              rows={3}
              className="w-full border border-border rounded-xl p-4 text-foreground outline-none focus:border-[#5e4368] transition-colors bg-surface resize-none"
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-bold text-foreground mb-1">{t.helpsLearn}</label>
            <p className="text-sm text-muted mb-3">{t.helpsLearnHint}</p>
            <textarea
              value={learningAccommodations}
              onChange={(e) => setLearningAccommodations(e.target.value)}
              rows={3}
              className="w-full border border-border rounded-xl p-4 text-foreground outline-none focus:border-[#5e4368] transition-colors bg-surface resize-none"
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-bold text-foreground mb-1">{t.alwaysDo}</label>
            <p className="text-sm text-muted mb-3">{t.alwaysDoHint}</p>
            <textarea
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              rows={3}
              className="w-full border border-border rounded-xl p-4 text-foreground outline-none focus:border-[#5e4368] transition-colors bg-surface resize-none"
            />
          </div>
        </div>

        {/* Voice picker — per language */}
        <div className="pt-6 border-t border-border">
          <h2 className="text-2xl font-bold text-foreground mb-1">{t.voice}</h2>
          <p className="text-sm text-muted mb-8">{t.voiceHint}</p>
          <div className="space-y-12">
            {(() => {
              const l = locale;
              const isEn = l === "en";
              const availableVoices = (voices?.[l] || []).filter(v => isEn ? v.accent === enAccent : true);

              return (
                <div key={l}>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted mb-6">{l.toUpperCase()} VOICE</div>
                  
                  {isEn && (
                    <div className="mb-8">
                      <h3 className="font-semibold text-foreground mb-4">Which English?</h3>
                      <div className="flex gap-4 overflow-x-auto pb-2">
                        {ENGLISH_ACCENTS.map(acc => (
                          <button
                            key={acc.id}
                            onClick={() => setEnAccent(acc.id)}
                            className={`border rounded-2xl p-5 min-w-[220px] text-left transition-colors ${
                              enAccent === acc.id 
                                ? 'border-[#5e4368] text-[#5e4368]' 
                                : 'border-border text-foreground hover:border-primary/50'
                            }`}
                          >
                            <div className="font-bold mb-1">{acc.label}</div>
                            <div className="text-sm text-muted">{acc.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <h3 className="font-semibold text-foreground mb-4">
                      And whose voice? {isEn && <span className="text-muted font-normal">(samples are in {ENGLISH_ACCENTS.find(a => a.id === enAccent)?.label} English)</span>}
                    </h3>
                    
                    {!voices ? (
                      <div className="flex items-center gap-2 text-sm text-muted py-4">
                        <Loader2 size={16} className="animate-spin" /> Loading voices...
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {availableVoices.map(v => {
                          const active = voiceSel[l] === v.id;
                          const isPlaying = playing === v.id;
                          return (
                            <button
                              key={v.id}
                              onClick={() => pickVoice(l, v.id)}
                              className={`flex items-center gap-4 border rounded-2xl p-4 text-left transition-colors ${
                                active 
                                  ? 'border-[#5e4368] bg-[#5e4368]/5' 
                                  : 'border-border bg-surface hover:border-[#5e4368]/50'
                              }`}
                            >
                              <div
                                onClick={(e) => { e.stopPropagation(); preview(l, v.id); }}
                                className="w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-full border border-border text-foreground hover:border-[#5e4368] transition-colors"
                              >
                                {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-bold text-foreground mb-0.5">{v.name}</div>
                                <div className="text-sm text-muted truncate">{v.gender}</div>
                              </div>
                              {active && (
                                <span className="text-xs font-bold text-[#5e4368] mr-2">Chosen</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        <button
          onClick={save}
          className="bg-[#aba3b0] hover:bg-[#978e9c] text-white rounded-full px-6 py-2.5 text-sm font-medium transition-all"
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