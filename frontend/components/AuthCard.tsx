"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AuthCard() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
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
        setMessage("Check your email to confirm signup.");
      }
    } catch (err: any) {
      setMessage(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-border p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-foreground mb-1">
        {mode === "login" ? "Welcome back" : "Create account"}
      </h3>
      <p className="text-sm text-muted mb-5">
        {mode === "login" ? "Sign in to continue learning" : "Start your learning journey"}
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
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
          {loading ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
        </button>
      </form>
      {message && (
        <div className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">
          {message}
        </div>
      )}
      <div className="mt-4 text-center">
        <button
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="text-sm text-primary hover:underline"
        >
          {mode === "login" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
