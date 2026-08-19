"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import UserAvatar from "@/components/UserAvatar";
import { useLocale, type Locale } from "@/components/LocaleProvider";

const LOCALES: Locale[] = ["kz", "ru"];

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string>("student");
  const { locale, setLocale } = useLocale();
  const [message, setMessage] = useState("");
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.push("/auth");
        return;
      }
      setUser(data.user);
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, lang")
        .eq("id", data.user.id)
        .single();
      if (profile) {
        setRole(profile.role);
        setLocale(profile.lang as Locale);
      }
    });
  }, [router, supabase, setLocale]);

  const save = async () => {
    setMessage("");
    if (!user) return;
    const { error } = await supabase
      .from("profiles")
      .update({ role, lang: locale })
      .eq("id", user.id);
    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Saved.");
    }
  };

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold text-foreground">Settings</h1>
        <UserAvatar />
      </div>

      <div className="bg-surface border border-border p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Role</label>
          <div className="grid grid-cols-2 gap-2 max-w-xs">
            {["student", "teacher"].map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={`py-2.5 text-sm font-medium border transition-all ${
                  role === r
                    ? "bg-primary/10 text-primary border-primary/30"
                    : "bg-surface text-muted border-border hover:bg-primary/5"
                }`}
              >
                {r === "student" ? "Student" : "Teacher"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Language</label>
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

        <button
          onClick={save}
          className="bg-primary hover:bg-primary-hover text-foreground px-6 py-2.5 text-sm font-medium transition-all"
        >
          Save changes
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