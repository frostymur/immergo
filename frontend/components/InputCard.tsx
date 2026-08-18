"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";

interface InputCardProps {
  onSubmit: (text: string) => void;
  placeholder?: string;
  loading?: boolean;
}

export default function InputCard({ onSubmit, placeholder = "Explain the Krebs cycle like I've never heard of it...", loading }: InputCardProps) {
  const [text, setText] = useState("");

  const handleSubmit = () => {
    if (text.trim() && !loading) {
      onSubmit(text.trim());
      setText("");
    }
  };

  return (
    <div className="bg-surface border border-border">
      <div className="p-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder={placeholder}
          rows={3}
          className="w-full resize-none outline-none text-sm text-foreground placeholder:text-muted/50 leading-relaxed"
        />
      </div>
      <div className="flex items-center justify-between px-4 pb-4">
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors">
            <span className="font-mono text-[10px] uppercase tracking-wider">Attach PDF</span>
          </button>
        </div>
        <button
          onClick={handleSubmit}
          disabled={loading || !text.trim()}
          className="flex items-center gap-2 bg-primary hover:bg-primary-hover disabled:opacity-40 text-foreground px-4 py-2 text-sm font-medium transition-colors"
        >
          Start
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}