"use client";

import { useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { LocaleProvider, useLocale, type Locale } from "@/components/LocaleProvider";
import AuthCard from "@/components/AuthCard";

const LOCALES: Locale[] = ["kz", "ru"];

function AuthPageInner() {
  const router = useRouter();
  const { locale, setLocale } = useLocale();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) router.push("/");
    });
  }, [router, supabase]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Link href="/" className="text-2xl font-bold text-primary tracking-tight">immergo</Link>
          <p className="text-sm text-muted mt-1">
            [ AI STUDY WORKSPACE ]
          </p>
        </div>

        <div className="flex justify-center gap-2">
          {LOCALES.map((l) => (
            <button
              key={l}
              onClick={() => setLocale(l)}
              className={`px-3 py-1 text-xs font-semibold uppercase transition-all ${
                locale === l ? "bg-primary text-foreground" : "bg-surface text-muted hover:bg-primary/10"
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        <AuthCard />
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