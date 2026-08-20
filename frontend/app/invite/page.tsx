"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLocale, type Locale } from "@/components/LocaleProvider";
import { BookOpen, Check, Loader2, UserPlus } from "lucide-react";

const I18N: Record<Locale, Record<string, string>> = {
  kz: {
    tag: "CLASS INVITE",
    joinTitle: "Сыныпқа қосылу",
    joining: "Қосылу…",
    joined: "Сіз сыныпқа қосылдыңыз!",
    already: "Сіз бұл сыныпқа қосылғансыз",
    open: "Сыныпты ашу",
    auth: "Қосылу үшін жүйеге кіріңіз",
    goAuth: "Кіру",
    error: "Сілтеме жарамсыз",
    toCabinet: "Кабинетке оралу",
  },
  ru: {
    tag: "CLASS INVITE",
    joinTitle: "Вступление в класс",
    joining: "Вступаем…",
    joined: "Вы вступили в класс!",
    already: "Вы уже в этом классе",
    open: "Открыть класс",
    auth: "Войдите, чтобы вступить в класс",
    goAuth: "Войти",
    error: "Ссылка недействительна",
    toCabinet: "Вернуться в кабинет",
  },
  en: {
    tag: "CLASS INVITE",
    joinTitle: "Join the class",
    joining: "Joining…",
    joined: "You joined the class!",
    already: "You are already in this class",
    open: "Open class",
    auth: "Sign in to join the class",
    goAuth: "Sign in",
    error: "Invalid invite link",
    toCabinet: "Back to cabinet",
  },
};

function InviteInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale } = useLocale();
  const t = I18N[locale];
  const supabase = createClient();

  const classId = searchParams.get("class") || "";
  const [state, setState] = useState<"loading" | "auth" | "notJoined" | "joined" | "error">("loading");
  const [joining, setJoining] = useState(false);
  const [workspaceTitle, setWorkspaceTitle] = useState("");

  useEffect(() => {
    if (!classId) {
      setState((s) => (s === "loading" ? "error" : s));
      return;
    }
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setState("auth");
        return;
      }
      const { data: ws } = await supabase
        .from("workspaces")
        .select("id, title, user_id")
        .eq("id", classId)
        .single();
      if (ws) setWorkspaceTitle(ws.title);
      const { data: existing } = await supabase
        .from("class_memberships")
        .select("id")
        .eq("workspace_id", classId)
        .eq("student_id", userData.user.id)
        .maybeSingle();
      setState(existing ? "joined" : "notJoined");
    })();
  }, [classId, supabase]);

  const join = async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    setJoining(true);
    const { error } = await supabase
      .from("class_memberships")
      .insert({ workspace_id: classId, student_id: userData.user.id });
    setJoining(false);
    if (!error) {
      const { data: ws } = await supabase
        .from("workspaces")
        .select("title")
        .eq("id", classId)
        .single();
      if (ws) setWorkspaceTitle(ws.title);
      setState("joined");
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-surface border border-border p-8 text-center space-y-5">
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted">[ {t.tag} ]</div>

        {state === "loading" && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted">
            <Loader2 size={14} className="animate-spin" /> …
          </div>
        )}

        {state === "auth" && (
          <>
            <div className="w-14 h-14 mx-auto bg-primary/10 border border-primary/30 flex items-center justify-center">
              <BookOpen size={22} className="text-primary" />
            </div>
            <p className="text-sm text-foreground">{t.auth}</p>
            <Link
              href="/auth"
              className="inline-block w-full h-10 bg-primary hover:bg-primary-hover text-foreground text-sm font-medium flex items-center justify-center transition-colors"
            >
              {t.goAuth}
            </Link>
          </>
        )}

        {state === "error" && <p className="text-sm text-red-600">{t.error}</p>}

        {state === "notJoined" && (
          <>
            <div className="w-14 h-14 mx-auto bg-primary/10 border border-primary/30 flex items-center justify-center">
              <UserPlus size={22} className="text-primary" />
            </div>
            <h1 className="text-lg font-semibold text-foreground">{t.joinTitle}</h1>
            <p className="text-sm text-muted">{workspaceTitle || classId.slice(0, 8)}</p>
            <button
              onClick={join}
              disabled={joining}
              className="w-full h-10 bg-primary hover:bg-primary-hover disabled:opacity-40 text-foreground text-sm font-medium transition-colors"
            >
              {joining ? t.joining : t.joinTitle}
            </button>
            <Link href="/dashboard" className="block text-xs text-muted hover:text-foreground">
              {t.toCabinet}
            </Link>
          </>
        )}

        {state === "joined" && (
          <>
            <div className="w-14 h-14 mx-auto bg-green-50 border border-green-300 flex items-center justify-center">
              <Check size={22} className="text-green-600" />
            </div>
            <h1 className="text-lg font-semibold text-foreground">{t.joined}</h1>
            <p className="text-sm text-muted">{workspaceTitle || classId.slice(0, 8)}</p>
            <Link
              href={`/workspace?workspace_id=${classId}`}
              className="inline-block w-full h-10 bg-primary hover:bg-primary-hover text-foreground text-sm font-medium flex items-center justify-center transition-colors"
            >
              {t.open}
            </Link>
            <Link href="/dashboard" className="block text-xs text-muted hover:text-foreground">
              {t.toCabinet}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense>
      <InviteInner />
    </Suspense>
  );
}