"use client";

const key = (lang: string) => `immergo-voice-${lang}`;

/** Per-language TTS voice chosen in Settings (localStorage — per browser). */
export function getSelectedVoice(lang: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  return localStorage.getItem(key(lang)) || undefined;
}

export function setSelectedVoice(lang: string, voice: string) {
  localStorage.setItem(key(lang), voice);
}
