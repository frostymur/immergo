"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLocale, type Locale } from "@/components/LocaleProvider";
import { Loader2, ShieldCheck, GraduationCap } from "lucide-react";

const I18N: Record<Locale, Record<string, string>> = {
  kz: {
    welcome: "Қайта оралуыңызбен",
    create: "Оқу жолын бастаңыз",
    loginSub: "Оқуды жалғастыру үшін кіріңіз",
    signupSub: "Жеке оқу жолыңызды құрыңыз",
    email: "Email",
    password: "Құпия сөз",
    emailPh: "you@example.com",
    passPh: "Құпия сөзді енгізіңіз",
    wait: "Күте тұрыңыз…",
    signin: "Кіру",
    signup: "Тіркелу",
    confirmEmail: "Растау үшін email тексеріңіз.",
    failed: "Кіру сәтсіз аяқталды",
    switchLogin: "Аккаунтыңыз бар ма? Кіру",
    switchSignup: "Аккаунтыңыз жоқ па? Тіркелу",
    sso: "Жылдам кіру (демо)",
    ssoHint: "Ендіру демонстрация үшін имитацияланады",
    bilimland: "BilimLand арқылы кіру",
    egov: "eGov ID арқылы кіру",
    connecting: "Қосылуда…",
  },
  ru: {
    welcome: "С возвращением",
    create: "Начните свой путь обучения",
    loginSub: "Войдите, чтобы продолжить обучение",
    signupSub: "Создайте свой учебный путь",
    email: "Email",
    password: "Пароль",
    emailPh: "you@example.com",
    passPh: "Введите пароль",
    wait: "Подождите…",
    signin: "Войти",
    signup: "Регистрация",
    confirmEmail: "Проверьте email для подтверждения.",
    failed: "Не удалось войти",
    switchLogin: "Уже есть аккаунт? Войти",
    switchSignup: "Нет аккаунта? Зарегистрироваться",
    sso: "Быстрый вход (демо)",
    ssoHint: "Имитация входа для демонстрации",
    bilimland: "Вход через BilimLand",
    egov: "Вход через eGov ID",
    connecting: "Подключение…",
  },
  en: {
    welcome: "Welcome back",
    create: "Start your learning journey",
    loginSub: "Sign in to continue learning",
    signupSub: "Create your study journey",
    email: "Email",
    password: "Password",
    emailPh: "you@example.com",
    passPh: "Enter your password",
    wait: "Please wait…",
    signin: "Sign in",
    signup: "Create account",
    confirmEmail: "Check your email to confirm signup.",
    failed: "Authentication failed",
    switchLogin: "Already have an account? Sign in",
    switchSignup: "Don't have an account? Sign up",
    sso: "Quick login (demo)",
    ssoHint: "Simulated login for demonstration",
    bilimland: "Sign in with BilimLand",
    egov: "Sign in with eGov ID",
    connecting: "Connecting…",
  },
};

const DEMO_ACCOUNTS = {
  bilimland: { email: "aigul.student@demo.kz", password: "demo123456" },
  egov: { email: "teacher.demo@demo.kz", password: "demo123456" },
} as const;

export default function AuthCard() {
  const { locale } = useLocale();
  const t = I18N[locale];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sso, setSso] = useState<"bilimland" | "egov" | null>(null);
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = "/";
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage(t.confirmEmail);
      }
    } catch (err: any) {
      setMessage(err.message || t.failed);
    } finally {
      setLoading(false);
    }
  };

  const handleSso = async (provider: "bilimland" | "egov") => {
    setSso(provider);
    setMessage("");
    try {
      await new Promise((r) => setTimeout(r, 1200));
      const account = DEMO_ACCOUNTS[provider];
      const { error } = await supabase.auth.signInWithPassword({
        email: account.email,
        password: account.password,
      });
      if (error) throw error;
      window.location.href = "/";
    } catch (err: any) {
      setMessage(err.message || t.failed);
      setSso(null);
    }
  };

  return (
    <div className="bg-surface border border-border p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-foreground mb-1">
        {mode === "login" ? t.welcome : t.create}
      </h3>
      <p className="text-sm text-muted mb-5">
        {mode === "login" ? t.loginSub : t.signupSub}
      </p>

      {/* Simulated SSO: BilimLand / eGov ID */}
      <div className="mb-5 space-y-2">
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted">
          [ {t.sso} ]
        </div>
        <button
          onClick={() => handleSso("bilimland")}
          disabled={sso !== null}
          className="flex items-center justify-center gap-2 w-full border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:border-primary transition-colors disabled:opacity-50"
        >
          {sso === "bilimland" ? <Loader2 size={14} className="animate-spin" /> : <GraduationCap size={14} className="text-primary" />}
          {sso === "bilimland" ? t.connecting : t.bilimland}
        </button>
        <button
          onClick={() => handleSso("egov")}
          disabled={sso !== null}
          className="flex items-center justify-center gap-2 w-full border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:border-primary transition-colors disabled:opacity-50"
        >
          {sso === "egov" ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} className="text-primary" />}
          {sso === "egov" ? t.connecting : t.egov}
        </button>
        <p className="text-[10px] text-muted/70">{t.ssoHint}</p>
      </div>

      <div className="flex items-center gap-3 mb-5">
        <div className="h-px flex-1 bg-border" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted">OR</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">{t.email}</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-border px-4 py-2.5 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
            placeholder={t.emailPh}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">{t.password}</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-border px-4 py-2.5 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
            placeholder={t.passPh}
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 text-foreground py-2.5 text-sm font-medium transition-all"
        >
          {loading ? t.wait : mode === "login" ? t.signin : t.signup}
        </button>
      </form>
      {message && (
        <div className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 p-3">
          {message}
        </div>
      )}
      <div className="mt-4 text-center">
        <button
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="text-sm text-primary hover:underline"
        >
          {mode === "login" ? t.switchSignup : t.switchLogin}
        </button>
      </div>
    </div>
  );
}