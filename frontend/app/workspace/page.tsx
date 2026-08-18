"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale } from "@/components/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { fetchSummary, generatePodcast, socraticAnswer, socraticChat, uploadPdf } from "@/lib/api";
import UserAvatar from "@/components/UserAvatar";
import { FileText, Mic, Square, Send, Upload, Radio, BookOpen, Loader2 } from "lucide-react";

type Source = { id: string; file_name: string; file_hash: string };

type DiagramNode = { id: string; label: string };
type DiagramEdge = [string, string];
type BoardCard = {
  type: string;
  content: string;
  expected_actions?: string[];
  diagram?: { nodes: DiagramNode[]; edges: DiagramEdge[] };
};

type BoardStep = {
  id: number;
  card: BoardCard;
  status: "pending" | "resolved";
  feedback?: string;
};

type Message = { role: "student" | "tutor"; text: string };

function WorkspaceInner() {
  const { locale, t } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const topic = searchParams.get("topic") || "General";

  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [summary, setSummary] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"sources" | "summary" | "podcast">("sources");
  const [podcastUrl, setPodcastUrl] = useState<string | null>(null);
  const [subtitles, setSubtitles] = useState<Array<{ speaker: string; text: string }>>([]);
  const [currentSubtitle, setCurrentSubtitle] = useState(0);

  const [chat, setChat] = useState<Message[]>([]);
  const [steps, setSteps] = useState<BoardStep[]>([]);
  const [pendingStep, setPendingStep] = useState<number | null>(null);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState("");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const stepCounter = useRef(1);
  const supabase = createClient();

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.replace("/auth");
        return;
      }
      const { data: workspaces } = await supabase
        .from("workspaces")
        .select("id")
        .eq("user_id", userData.user.id)
        .limit(1);
      if (workspaces && workspaces.length > 0) {
        if (mounted) setWorkspaceId(workspaces[0].id);
      } else {
        const { data: newWs, error: wsErr } = await supabase
          .from("workspaces")
          .insert({
            title: topic,
            subject: "General",
            grade: "9",
            user_id: userData.user.id,
          })
          .select("id")
          .single();
        if (wsErr) {
          if (mounted) setError(wsErr.message);
          return;
        }
        if (mounted) setWorkspaceId(newWs.id);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [supabase, topic, router]);

  useEffect(() => {
    if (!workspaceId) return;
    supabase
      .from("sources")
      .select("id, file_name, file_hash")
      .eq("workspace_id", workspaceId)
      .then(({ data }) => {
        if (data) setSources(data);
      });
  }, [workspaceId, supabase]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || subtitles.length === 0) return;
    const handler = () => {
      const idx = Math.min(
        Math.floor((audio.currentTime / Math.max(1, audio.duration)) * subtitles.length),
        subtitles.length - 1
      );
      setCurrentSubtitle(idx);
    };
    audio.addEventListener("timeupdate", handler);
    return () => audio.removeEventListener("timeupdate", handler);
  }, [subtitles.length]);

  const recordProgress = async (nodeId: string, status: "completed" | "failed", errorCount = 0) => {
    if (!workspaceId) return;
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    await supabase.from("student_progress").insert({
      student_id: userData.user.id,
      workspace_id: workspaceId,
      node_id: nodeId,
      status,
      error_count: errorCount,
    });
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !workspaceId) return;
    setLoading(true);
    setError("");
    try {
      const res = await uploadPdf(workspaceId, file);
      const source: Source = { id: res.source_id, file_name: file.name, file_hash: res.file_hash };
      setSources((prev) => [...prev.filter((s) => s.id !== source.id), source]);
      setActiveTab("summary");
      setSummaryLoading(true);
      try {
        const s = await fetchSummary(workspaceId, res.source_id, locale);
        setSummary(s.summary);
      } catch {
        setSummary(`Indexed ${res.chunks_indexed} chunks from ${file.name}. Open the Sources tab to generate a full summary.`);
      } finally {
        setSummaryLoading(false);
      }
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateSummary = async (sourceId: string) => {
    if (!workspaceId) return;
    setSummaryLoading(true);
    setError("");
    try {
      const res = await fetchSummary(workspaceId, sourceId, locale);
      setSummary(res.summary);
      setActiveTab("summary");
    } catch (err: any) {
      setError(err.message || "Summary generation failed");
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleGeneratePodcast = async (sourceId: string) => {
    if (!workspaceId) return;
    setLoading(true);
    setError("");
    try {
      const res = await generatePodcast(workspaceId, sourceId, locale);
      setPodcastUrl(res.audio_url);
      setSubtitles(res.dialogue || []);
      setCurrentSubtitle(0);
      setActiveTab("podcast");
    } catch (err: any) {
      setError(err.message || "Podcast generation failed");
    } finally {
      setLoading(false);
    }
  };

  const pushStep = (card: BoardCard, feedback?: string): number => {
    const id = stepCounter.current++;
    setSteps((prev) => [...prev, { id, card, status: "pending", feedback }]);
    setPendingStep(id);
    return id;
  };

  const handleSend = async () => {
    const text = question.trim();
    if (!text || !workspaceId || loading) return;
    setQuestion("");
    setError("");
    setChat((prev) => [...prev, { role: "student", text }]);

    if (pendingStep !== null) {
      // Student answering an open whiteboard step -> evaluate via backend
      setLoading(true);
      try {
        const res = await socraticAnswer(workspaceId, steps.find((s) => s.id === pendingStep)?.card.content || "", text, locale);
        setChat((prev) => [...prev, { role: "tutor", text: res.feedback }]);
        setSteps((prev) =>
          prev.map((s) =>
            s.id === pendingStep ? { ...s, status: "resolved" } : s
          )
        );
        const nodeId = `topic:${topic.toLowerCase().replace(/\s+/g, "-")}`;
        await recordProgress(nodeId, res.correct ? "completed" : "failed", res.correct ? 0 : 1);
        if (!res.correct) {
          // Wrong -> Lumi pushes the next guiding step instead of the answer
          pushStep(res.card, res.feedback);
        } else {
          setPendingStep(null);
        }
      } catch (err: any) {
        setError(err.message || "Evaluation failed");
      } finally {
        setLoading(false);
      }
    } else {
      // New question -> Socratic chat returns feedback + first whiteboard card
      setLoading(true);
      try {
        const res = await socraticChat(workspaceId, text, locale);
        setChat((prev) => [...prev, { role: "tutor", text: res.feedback }]);
        pushStep(res.card);
        await recordProgress(`topic:${topic.toLowerCase().replace(/\s+/g, "-")}`, "completed");
      } catch (err: any) {
        setError(err.message || "Something went wrong. Please try again.");
      } finally {
        setLoading(false);
      }
    }
  };

  const toggleMic = () => {
    if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      setError("Speech recognition not supported in this browser. Use Chrome or Edge.");
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (isListening) {
      setIsListening(false);
      return;
    }
    const recognition = new SR();
    recognition.lang = locale === "kz" ? "kk-KZ" : locale === "ru" ? "ru-RU" : "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setQuestion((prev) => (prev ? prev + " " + transcript : transcript));
    };
    recognition.onerror = () => setIsListening(false);
    recognition.start();
  };

  const renderDiagram = (diagram: { nodes: DiagramNode[]; edges: DiagramEdge[] }) => {
    const edges = new Set(diagram.edges.map(([a, b]) => `${a}->${b}`));
    return (
      <div className="p-3 bg-white border border-border mt-2">
        <div className="flex flex-wrap items-stretch gap-1.5">
          {diagram.nodes.map((n, i) => (
            <div key={n.id} className="flex items-center gap-1.5">
              <div className="border border-foreground px-2 py-1 text-[11px] font-mono bg-surface">
                {n.label}
              </div>
              {i < diagram.nodes.length - 1 &&
                (edges.has(`${diagram.nodes[i].id}->${diagram.nodes[i + 1].id}`) ? (
                  <span className="text-[11px] text-muted">→</span>
                ) : (
                  <span className="text-[11px] text-muted">·</span>
                ))}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const pendingCardText = pendingStep !== null
    ? steps.find((s) => s.id === pendingStep)?.card.content
    : null;

  return (
    <div className="flex flex-col min-h-screen">
      <header className="flex items-center justify-between px-6 py-3 border-b border-border bg-white">
        <div className="flex items-center gap-4">
          <div>
            <div className="text-sm font-semibold">{topic}</div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted">
              [ LUMI_CANVAS: {pendingStep !== null ? "STEP_OPEN" : "ACTIVE"} ]
            </div>
          </div>
        </div>
        <UserAvatar />
      </header>

      {error && (
        <div className="border-b border-border bg-white px-6 py-2.5 text-sm text-red-600 font-mono">
          [ ERROR ] {error}
        </div>
      )}

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border">
        {/* LEFT: material panel */}
        <section className="flex flex-col min-h-0">
          <div className="flex border-b border-border">
            {[
              { key: "sources" as const, label: t("sources"), icon: FileText },
              { key: "summary" as const, label: t("summary"), icon: BookOpen },
              { key: "podcast" as const, label: t("podcast"), icon: Radio },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium font-mono uppercase tracking-wider transition-colors border-r border-border ${
                  activeTab === tab.key
                    ? "bg-foreground text-white"
                    : "text-muted hover:text-foreground"
                }`}
              >
                <tab.icon size={12} />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-auto p-6">
            {activeTab === "sources" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
                    [ SOURCES ]
                  </span>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading}
                    className="flex items-center gap-2 bg-foreground hover:bg-primary-hover disabled:opacity-40 text-white px-3 py-2 text-xs font-medium transition-colors"
                  >
                    <Upload size={12} />
                    {t("upload")}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={handleUpload}
                  />
                </div>

                {sources.length === 0 ? (
                  <div className="border border-dashed border-border p-8 text-center">
                    <div className="text-sm text-muted">
                      No materials yet. Upload a PDF to start your lesson.
                    </div>
                  </div>
                ) : (
                  sources.map((s, idx) => (
                    <div key={s.id} className="border border-border bg-surface">
                      <div className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <FileText size={14} className="text-muted flex-shrink-0" />
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{s.file_name}</div>
                            <div className="font-mono text-[10px] text-muted">
                              {String(idx + 1).padStart(2, "0")} · {s.file_hash.slice(0, 8)}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => handleGenerateSummary(s.id)}
                            disabled={summaryLoading}
                            className="border border-border bg-white px-2.5 py-1.5 text-[11px] font-medium hover:border-foreground transition-colors disabled:opacity-40"
                          >
                            {t("summary")}
                          </button>
                          <button
                            onClick={() => handleGeneratePodcast(s.id)}
                            disabled={loading}
                            className="border border-border bg-white px-2.5 py-1.5 text-[11px] font-medium hover:border-foreground transition-colors disabled:opacity-40"
                          >
                            {t("generate.podcast")}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === "summary" && (
              <div className="space-y-3">
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
                  [ SUMMARY ]
                </span>
                {summaryLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted py-4">
                    <Loader2 size={14} className="animate-spin" />
                    Generating summary…
                  </div>
                ) : summary ? (
                  <div className="text-sm leading-relaxed whitespace-pre-wrap border border-border p-4 bg-surface">
                    {summary}
                  </div>
                ) : (
                  <div className="text-sm text-muted">
                    Select a source and press “{t("summary")}” to generate a lesson summary.
                  </div>
                )}
              </div>
            )}

            {activeTab === "podcast" && (
              <div className="space-y-3">
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
                  [ PODCAST ]
                </span>
                {podcastUrl ? (
                  <>
                    <audio
                      ref={audioRef}
                      src={podcastUrl}
                      className="w-full"
                      controls
                    />
                    <div className="border border-border bg-surface p-3 h-48 overflow-y-auto">
                      {subtitles.length === 0 ? (
                        <div className="text-sm text-muted">No transcript available.</div>
                      ) : (
                        subtitles.map((sub, idx) => (
                          <div
                            key={idx}
                            className={`text-sm mb-2 ${
                              idx === currentSubtitle ? "text-foreground font-medium" : "text-muted"
                            }`}
                          >
                            <span className="font-mono text-[10px] uppercase mr-2">
                              {sub.speaker}
                            </span>
                            {sub.text}
                          </div>
                        ))
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-muted">
                    Generate a podcast from a source to listen to the lesson breakdown.
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* RIGHT: whiteboard + socratic chat */}
        <section className="flex flex-col min-h-0">
          <div className="flex items-center justify-between px-6 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
                [ WHITEBOARD ]
              </span>
              {pendingCardText && (
                <span className="font-mono text-[10px] uppercase tracking-widest text-foreground border border-foreground px-1.5 py-0.5">
                  STEP {steps.filter((s) => s.status === "pending").length} OPEN
                </span>
              )}
            </div>
          </div>

          {/* Board canvas */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-surface/50">
            {steps.length === 0 ? (
              <div className="border border-dashed border-border p-8 text-center mt-8">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted mb-2">
                  [ LUMI_CANVAS: AWAITING_INPUT ]
                </div>
                <p className="text-sm text-muted">
                  Ask a question about your material. Lumi will break the topic into guiding
                  steps on this board — you solve each one yourself.
                </p>
              </div>
            ) : (
              steps.map((step, i) => (
                <div
                  key={step.id}
                  className={`border p-4 bg-white ${
                    step.status === "resolved" ? "border-foreground" : "border-foreground"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
                      STEP {String(i + 1).padStart(2, "0")} · {step.card.type.toUpperCase()}
                    </span>
                    <span
                      className={`font-mono text-[10px] uppercase tracking-widest ${
                        step.status === "resolved" ? "text-green-700" : "text-foreground"
                      }`}
                    >
                      {step.status === "resolved" ? "[ RESOLVED ]" : "[ PENDING ]"}
                    </span>
                  </div>
                  <div className="text-sm leading-relaxed">{step.card.content}</div>
                  {step.card.expected_actions && step.card.expected_actions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {step.card.expected_actions.map((a: string) => (
                        <span key={a} className="border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted uppercase tracking-wider">
                          {a}
                        </span>
                      ))}
                    </div>
                  )}
                  {step.card.diagram && renderDiagram(step.card.diagram)}
                </div>
              ))
            )}

            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted">
                <Loader2 size={14} className="animate-spin" />
                Lumi is thinking…
              </div>
            )}
          </div>

          {/* Chat transcript */}
          <div className="border-t border-border bg-white max-h-40 overflow-y-auto">
            {chat.length === 0 ? (
              <div className="px-6 py-3 text-xs text-muted">
                Transcript appears here as you work through the board.
              </div>
            ) : (
              chat.map((m, idx) => (
                <div
                  key={idx}
                  className={`px-6 py-2 border-b border-border/50 text-sm ${
                    m.role === "student" ? "text-foreground" : "text-muted"
                  }`}
                >
                  <span className="font-mono text-[10px] uppercase mr-2">
                    {m.role === "student" ? "YOU" : "LUMI"}
                  </span>
                  {m.text}
                </div>
              ))
            )}
          </div>

          {/* Input */}
          <div className="border-t border-border p-4 bg-white">
            <div className="flex items-center gap-2">
              <button
                onClick={toggleMic}
                title="Voice input (Chrome/Edge)"
                className={`flex items-center justify-center w-10 h-10 border transition-colors ${
                  isListening
                    ? "border-red-500 bg-red-500 text-white"
                    : "border-border text-muted hover:border-foreground hover:text-foreground"
                }`}
              >
                {isListening ? <Square size={14} /> : <Mic size={14} />}
              </button>
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder={
                  pendingCardText
                    ? "Answer the open step…"
                    : t("chat.placeholder")
                }
                className="flex-1 h-10 border border-border px-3 text-sm outline-none focus:border-foreground transition-colors"
              />
              <button
                onClick={handleSend}
                disabled={loading || !question.trim()}
                className="flex items-center justify-center w-10 h-10 bg-foreground hover:bg-primary-hover disabled:opacity-40 text-white transition-colors"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default function WorkspacePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-sm text-muted">Loading…</div>}>
      <WorkspaceInner />
    </Suspense>
  );
}