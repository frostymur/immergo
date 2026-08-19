"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type Locale = "kz" | "ru" | "en";

interface LocaleContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

const DICTIONARY: Record<Locale, Record<string, string>> = {
  kz: {
    "landing.title": "AI STUDY WORKSPACE",
    "landing.subtitle": "Жекелендірілген оқу платформасы",
    "student.mode": "Оқушы режимі",
    "student.desc": "Интерактивті тақта, AI-тъютор және дауыстық диалог.",
    "teacher.mode": "Мұғалім кабинеті",
    "teacher.desc": "Сынып басқаруы, аналитика және Heatmap.",
    "sources": "Дереккөздер",
    "summary": "Қорытынды",
    "podcast": "Подкаст",
    "practice": "Жаттығу",
    "chat": "Сократ диалогі",
    "chat.placeholder": "Сұрағыңызды жазыңыз...",
    "upload": "PDF жүктеу",
    "generate.podcast": "Подкаст жасау",
    "class.table": "Сынып кестесі",
    "heatmap": "Қиын тақырыптар",
    "upload.material": "Материал жүктеу",
    "diagnostic": "Жылдам диагностика",
    "start": "Бастау",
    "auth.welcomeBack": "Қайта оралуыңызбен",
    "auth.createAccount": "Оқу жолын бастаңыз",
    "auth.checkEmail": "Растау үшін email тексеріңіз",
    "auth.signup": "Тіркелу",
    "auth.login": "Кіру",
    "auth.name": "Атыңыз",
    "auth.role": "Рөліңіз",
    "auth.student": "Оқушы",
    "auth.teacher": "Мұғалім",
    "auth.signout": "Шығу",
    "auth.profile": "Профиль",
    "auth.settings": "Баптаулар",
    "auth.signin": "Кіру",
  },
  ru: {
    "landing.title": "AI STUDY WORKSPACE",
    "landing.subtitle": "Персонализированная образовательная платформа",
    "student.mode": "Режим ученика",
    "student.desc": "Интерактивная доска, ИИ-репетитор и голосовой диалог.",
    "teacher.mode": "Кабинет учителя",
    "teacher.desc": "Управление классом, аналитика и Heatmap.",
    "sources": "Источники",
    "summary": "Сводка",
    "podcast": "Подкаст",
    "practice": "Практика",
    "chat": "Сократовский диалог",
    "chat.placeholder": "Введите ваш вопрос...",
    "upload": "Загрузить PDF",
    "generate.podcast": "Создать подкаст",
    "class.table": "Таблица класса",
    "heatmap": "Проблемные темы",
    "upload.material": "Загрузить материал",
    "diagnostic": "Быстрая диагностика",
    "start": "Старт",
    "auth.welcomeBack": "С возвращением",
    "auth.createAccount": "Начните свой путь обучения",
    "auth.checkEmail": "Проверьте email для подтверждения",
    "auth.signup": "Регистрация",
    "auth.login": "Войти",
    "auth.name": "Ваше имя",
    "auth.role": "Ваша роль",
    "auth.student": "Ученик",
    "auth.teacher": "Учитель",
    "auth.signout": "Выйти",
    "auth.profile": "Профиль",
    "auth.settings": "Настройки",
    "auth.signin": "Войти",
  },
  en: {
    "landing.title": "AI STUDY WORKSPACE",
    "landing.subtitle": "Personalized learning platform",
    "student.mode": "Student Mode",
    "student.desc": "Interactive board, AI tutor and voice dialogue.",
    "teacher.mode": "Teacher Cabinet",
    "teacher.desc": "Class management, analytics and Heatmap.",
    "sources": "Sources",
    "summary": "Summary",
    "podcast": "Podcast",
    "practice": "Practice",
    "chat": "Socratic Dialog",
    "chat.placeholder": "Type your question...",
    "upload": "Upload PDF",
    "generate.podcast": "Generate Podcast",
    "class.table": "Class Table",
    "heatmap": "Problem Topics",
    "upload.material": "Upload Material",
    "diagnostic": "Quick Diagnostic",
    "start": "Start",
    "auth.welcomeBack": "Welcome back",
    "auth.createAccount": "Start your learning journey",
    "auth.checkEmail": "Check your email to confirm signup",
    "auth.signup": "Sign up",
    "auth.login": "Sign in",
    "auth.name": "Your name",
    "auth.role": "Your role",
    "auth.student": "Student",
    "auth.teacher": "Teacher",
    "auth.signout": "Sign out",
    "auth.profile": "Profile",
    "auth.settings": "Settings",
    "auth.signin": "Sign in",
  },
};

function normalizeLocale(l: string | null | undefined): Locale {
  return l === "kz" || l === "ru" ? l : "kz";
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("kz");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("lang")
          .eq("id", data.user.id)
          .single();
        if (!cancelled && profile?.lang) {
          const lang = normalizeLocale(profile.lang as string);
          setLocaleState(lang);
          localStorage.setItem("lumi-locale", lang);
          return;
        }
      }
      if (!cancelled) {
        const saved = localStorage.getItem("lumi-locale");
        setLocaleState(normalizeLocale(saved));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    localStorage.setItem("lumi-locale", l);
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        await supabase.from("profiles").update({ lang: l }).eq("id", data.user.id);
      }
    })();
  };

  const t = (key: string) => DICTIONARY[locale][key] || key;

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}
