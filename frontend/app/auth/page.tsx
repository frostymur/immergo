"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { LocaleProvider, useLocale } from "@/components/LocaleProvider";

const LOCALES = ["kz", "ru", "en"] as const;

function AuthPageInner() {
  const router = useRouter();
  const { locale, setLocale, t } = useLocale();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"student" | "teacher">("student");
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) router.push("/");
    });
  }, [router, supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { role, full_name: name } },
        });
        if (error) throw error;
        setMessage(t("auth.checkEmail"));
      }
    } catch (err: any) {
      setMessage(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Link href="/" className="text-2xl font-bold text-primary tracking-tight">immergo</Link>
          <p className="text-sm text-muted mt-1">
            {mode === "login" ? t("auth.welcomeBack") : t("auth.createAccount")}
          </p>
        </div>

        {/* Locale switcher */}
        <div className="flex justify-center gap-2">
          {LOCALES.map((l) => (
            <button
              key={l}
              onClick={() => setLocale(l)}
              className={`px-3 py-1 rounded-full text-xs font-semibold uppercase transition-all ${
                locale === l ? "bg-primary text-white" : "bg-surface text-muted hover:bg-primary/10"
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-border p-6 shadow-sm">
          <div className="flex border border-border rounded-xl mb-5 overflow-hidden">
            {(["signup", "login"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-2.5 text-sm font-medium transition-all ${
                  mode === m ? "bg-primary text-white" : "bg-surface text-muted hover:bg-primary/5"
                }`}
              >
                {m === "signup" ? t("auth.signup") : t("auth.login")}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">{t("auth.name")}</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">{t("auth.role")}</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["student", "teacher"] as const).map((r) => (
                      <button
                        type="button"
                        key={r}
                        onClick={() => setRole(r)}
                        className={`py-2.5 rounded-xl text-sm font-medium border transition-all ${
                          role === r
                            ? "bg-primary/10 text-primary border-primary/30"
                            : "bg-surface text-muted border-border hover:bg-primary/5"
                        }`}
                      >
                        {r === "student" ? t("auth.student") : t("auth.teacher")}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
                placeholder="you@example.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
                placeholder="Enter your password"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium transition-all"
            >
              {loading ? "..." : mode === "login" ? t("auth.login") : t("auth.signup")}
            </button>
          </form>

          {message && (
            <div className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">
              {message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <LocaleProvider>
      <AuthPageInner />
    </LocaleProvider>
  );
}