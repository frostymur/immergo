"use client";

import { useRef, useState } from "react";
import { ArrowRight, Paperclip, X, FileText } from "lucide-react";
import { setPendingMaterial } from "@/lib/pendingMaterial";

interface InputCardProps {
  onSubmit: (text: string) => void;
  placeholder?: string;
  loading?: boolean;
}

export default function InputCard({ onSubmit, placeholder = "Explain the Krebs cycle like I've never heard of it...", loading }: InputCardProps) {
  const [text, setText] = useState("");
  const [attached, setAttached] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSubmit = () => {
    if (text.trim() && !loading) {
      setPendingMaterial(attached);
      onSubmit(text.trim());
      setText("");
      setAttached(null);
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setAttached(file);
    e.target.value = "";
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
      {attached && (
        <div className="mx-4 mb-2 flex items-center gap-2 border border-border bg-background px-3 py-2">
          <FileText size={13} className="text-muted flex-shrink-0" />
          <span className="text-xs text-foreground truncate flex-1">{attached.name}</span>
          <button
            onClick={() => setAttached(null)}
            className="text-muted hover:text-foreground transition-colors"
            title="Remove attachment"
          >
            <X size={13} />
          </button>
        </div>
      )}
      <div className="flex items-center justify-between px-4 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors"
          >
            <Paperclip size={12} />
            <span className="font-mono text-[10px] uppercase tracking-wider">Attach PDF</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={handleFile}
          />
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
