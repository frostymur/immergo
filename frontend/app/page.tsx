"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import InputCard from "@/components/InputCard";
import UserAvatar from "@/components/UserAvatar";

const suggestedPrompts = [
  "Explain integration by parts, with examples",
  "I have a Chemistry test on Friday — bonding",
  "How does photosynthesis work step by step?",
  "Help me understand Newton's third law",
];

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSubmit = (text: string) => {
    setLoading(true);
    router.push(`/workspace?topic=${encodeURIComponent(text)}`);
  };

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted">
          [ SYSTEM: ONLINE ]
        </div>
        <UserAvatar />
      </div>

      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-12">
        <div className="w-full max-w-2xl space-y-8">
          <div className="text-center space-y-4">
            <span className="inline-block font-mono text-[10px] uppercase tracking-widest text-muted border border-border px-2 py-1">
              [ AI STUDY WORKSPACE ]
            </span>
            <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-foreground leading-tight">
              Learn anything.
              <br />
              Ace everything.
            </h1>
            <p className="text-muted text-base max-w-lg mx-auto leading-relaxed">
              Ask Immergo anything. It plans the lesson and works through it with you —
              guiding you step by step on the board, never giving the answer away.
            </p>
          </div>

          <InputCard onSubmit={handleSubmit} loading={loading} />

          <div className="flex flex-wrap justify-center gap-2">
            {suggestedPrompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => handleSubmit(prompt)}
                className="px-4 py-2 border border-border text-sm text-muted hover:border-foreground hover:text-foreground transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border border border-border">
            <Link
              href="/workspace"
              className="bg-white p-5 hover:bg-surface transition-colors"
            >
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted">
                [ STUDENT ]
              </div>
              <div className="text-sm font-semibold mt-2">
                Learn by yourself
              </div>
              <p className="text-xs text-muted mt-1">
                Upload a PDF. Lumi builds a whiteboard lesson around it and guides you with
                questions until you solve it yourself.
              </p>
            </Link>
            <Link
              href="/teacher"
              className="bg-white p-5 hover:bg-surface transition-colors"
            >
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted">
                [ TEACHER ]
              </div>
              <div className="text-sm font-semibold mt-2">
                Teacher console
              </div>
              <p className="text-xs text-muted mt-1">
                Upload class materials, assign them, and watch a heatmap of where students
                stumble on the board.
              </p>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}