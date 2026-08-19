"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale } from "@/components/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import {
  fetchLesson,
  fetchTtsAudio,
  streamLessonMessage,
  streamLessonStart,
  uploadPdf,
  type LessonBlock,
  type LessonEvent,
  type LessonPlanStep,
} from "@/lib/api";
import { takePendingMaterial } from "@/lib/pendingMaterial";
import {
  FileText,
  Loader2,
  MessageSquare,
  Minus,
  Pause,
  Play,
  Plus,
  Send,
  Square,
  Upload,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

type Source = { id: string; file_name: string; file_hash: string };
type ConnStatus = "idle" | "connecting" | "live" | "reconnecting";

type SpeakJob = { key: number; text: string };

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

function WorkspaceInner() {
  const { locale } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const topic = searchParams.get("topic") || "";
  const workspaceIdParam = searchParams.get("workspace_id");
  const lessonParam = searchParams.get("lesson");

  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [lessonTitle, setLessonTitle] = useState<string>(topic);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<LessonBlock[]>([]);
  const [plan, setPlan] = useState<LessonPlanStep[]>([]);
  const [status, setStatus] = useState<ConnStatus>("idle");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");

  // Student input (text-only prototype)
  const [inputText, setInputText] = useState("");
  const messageInputRef = useRef<HTMLInputElement | null>(null);

  // Panels
  const [materialOpen, setMaterialOpen] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [sources, setSources] = useState<Source[]>([]);
  const [uploading, setUploading] = useState(false);

  // Board view — the board is an infinite canvas, pannable in any direction
  const [follow, setFollow] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{
    startX: number;
    startY: number;
    startPanX: number;
    startPanY: number;
    active: boolean;
  } | null>(null);

  // Speech playback (Lumi speaks the board via TTS)
  const [paused, setPaused] = useState(false);
  const [volume, setVolume] = useState(0.9);
  const [speakingKey, setSpeakingKey] = useState<number | null>(null);
  const [caption, setCaption] = useState("");
  const [captionProg, setCaptionProg] = useState(0);
  const [spokenUpTo, setSpokenUpTo] = useState(-1);
  const captionRef = useRef("");

  const boardRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speakQueue = useRef<SpeakJob[]>([]);
  const audioCache = useRef<Map<number, string>>(new Map());
  const playingRef = useRef(false);
  const pausedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const initRef = useRef(false);
  const supabase = createClient();

  // -------------------------------------------------------------------------
  // Speech (TTS) engine — plays each block's "speak" text in order
  // -------------------------------------------------------------------------
  const pumpSpeech = useCallback(async () => {
    if (playingRef.current || pausedRef.current) return;
    for (;;) {
      const job = speakQueue.current[0];
      if (!job) {
        playingRef.current = false;
        setSpeakingKey(null);
        setCaption("");
        setCaptionProg(0);
        captionRef.current = "";
        return;
      }
      playingRef.current = true;
      let url = audioCache.current.get(job.key);
      if (!url) {
        try {
          const blob = await fetchTtsAudio(job.text, locale);
          url = URL.createObjectURL(blob);
          audioCache.current.set(job.key, url);
        } catch {
          // TTS failed for this block — mark it written so it still shows on
          // the board, then skip to the next one
          speakQueue.current.shift();
          setSpokenUpTo(job.key);
          continue;
        }
      }
      const audio = audioRef.current;
      if (!audio) {
        playingRef.current = false;
        return;
      }
      speakQueue.current.shift();
      audio.src = url;
      audio.volume = volume;
      setSpeakingKey(job.key);
      setSpokenUpTo(job.key);
      setCaption(job.text);
      setCaptionProg(0);
      captionRef.current = job.text;
      try {
        await audio.play();
        return; // playing now — the "ended" listener pumps the next job
      } catch {
        // Autoplay blocked (no user gesture yet) — pause and wait for the
        // student to press play instead of silently dropping speech.
        speakQueue.current.unshift(job);
        playingRef.current = false;
        pausedRef.current = true;
        setPaused(true);
        return;
      }
    }
  }, [locale, volume]);

  const enqueueSpeech = useCallback(
    (key: number, text?: string) => {
      if (!text || !text.trim()) return;
      speakQueue.current.push({ key, text });
      // Prefetch audio for smoother playback
      if (!audioCache.current.has(key)) {
        fetchTtsAudio(text, locale)
          .then((blob) => {
            audioCache.current.set(key, URL.createObjectURL(blob));
          })
          .catch(() => {});
      }
      pumpSpeech();
    },
    [locale, pumpSpeech]
  );

  const stopSpeech = useCallback(() => {
    speakQueue.current = [];
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
    }
    playingRef.current = false;
    pausedRef.current = false;
    setPaused(false);
    setSpeakingKey(null);
    setCaption("");
    setCaptionProg(0);
    captionRef.current = "";
  }, []);

  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;
    const cache = audioCache.current;
    const onEnded = () => {
      playingRef.current = false;
      setSpeakingKey(null);
      pumpSpeech();
    };
    audio.addEventListener("ended", onEnded);
    // Drive caption + board reveal straight from the audio clock at ~60fps so
    // notes always appear exactly as Lumi speaks them.
    let raf = 0;
    const tick = () => {
      if (captionRef.current && audio.duration && isFinite(audio.duration)) {
        const t = audio.currentTime / audio.duration;
        setCaptionProg(Math.min(1, Math.max(0, t)));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      audio.removeEventListener("ended", onEnded);
      audio.pause();
      cache.forEach((url) => URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  const togglePause = () => {
    const audio = audioRef.current;
    setPaused((prev) => {
      const next = !prev;
      pausedRef.current = next;
      if (audio) {
        if (next) {
          audio.pause();
        } else {
          audio.play().catch(() => {});
          pumpSpeech();
        }
      }
      return next;
    });
  };

  // -------------------------------------------------------------------------
  // Lesson streaming
  // -------------------------------------------------------------------------
  const handleEvent = useCallback(
    (event: LessonEvent) => {
      if (event.kind === "plan") {
        setPlan(event.steps);
      } else if (event.kind === "session") {
        setSessionId(event.session_id);
        router.replace(`/workspace?lesson=${event.session_id}`);
      } else if (event.kind === "block" || event.kind === "student") {
        setBlocks((prev) => {
          const next = [...prev];
          next[event.idx] = event.block;
          return next;
        });
        if (event.kind === "block") {
          if (event.block.speak) enqueueSpeech(event.idx, event.block.speak);
          if (event.block.kind === "feedback" && typeof event.block.correct === "boolean") {
            recordProgressRef.current?.(event.block.correct);
          }
        }
      } else if (event.kind === "done") {
        setStreaming(false);
        setStatus("live");
      } else if (event.kind === "error") {
        setStreaming(false);
        setStatus("reconnecting");
        setError(event.message || "Lesson stream error");
      }
    },
    [enqueueSpeech, router]
  );

  const handleStreamError = useCallback((err?: unknown) => {
    setStreaming(false);
    setStatus("reconnecting");
    setError(
      err instanceof Error && err.message
        ? err.message
        : "Connection lost — rejoin to pick up where you left off."
    );
  }, []);

  const startLesson = useCallback(
    (wsId: string, prompt: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setStatus("connecting");
      setStreaming(true);
      setError("");
      setSpokenUpTo(-1);
      let sawDone = false;
      streamLessonStart(
        wsId,
        prompt,
        locale,
        {
          onEvent: (e) => {
            if (e.kind === "done") sawDone = true;
            handleEvent(e);
          },
          onError: handleStreamError,
        },
        controller.signal
      ).then(() => {
        if (!sawDone && !controller.signal.aborted) handleStreamError();
      });
    },
    [locale, handleEvent, handleStreamError]
  );

  const sendStudentMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !sessionId || streaming) return;
      // Interrupt Lumi when the student speaks — like a real conversation
      stopSpeech();
      setStreaming(true);
      setError("");
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      let sawDone = false;
      streamLessonMessage(
        sessionId,
        trimmed,
        {
          onEvent: (e) => {
            if (e.kind === "done") sawDone = true;
            handleEvent(e);
          },
          onError: handleStreamError,
        },
        controller.signal
      ).then(() => {
        if (!sawDone && !controller.signal.aborted) handleStreamError();
      });
    },
    [sessionId, streaming, handleEvent, handleStreamError, stopSpeech]
  );

  const rejoin = useCallback(async () => {
    if (!sessionId) return;
    setError("");
    setStatus("connecting");
    try {
      const data = await fetchLesson(sessionId);
      setBlocks(data.blocks.map((b) => b.block));
      setPlan(data.plan || []);
      setLessonTitle(data.session.prompt);
      setSpokenUpTo(data.blocks.length - 1);
      setStatus("live");
      setStreaming(false);
      stopSpeech();
    } catch (err: unknown) {
      setStatus("reconnecting");
      setError(errorMessage(err, "Could not rejoin the lesson"));
    }
  }, [sessionId, stopSpeech]);

  // -------------------------------------------------------------------------
  // Bootstrap
  // -------------------------------------------------------------------------
  useEffect(() => {
    // Guard against StrictMode double-invocation: bootstrap must run exactly once.
    if (initRef.current) return;
    initRef.current = true;

    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.replace("/auth");
        return;
      }
      const userId = userData.user.id;

      // Rejoin an existing lesson directly
      if (lessonParam) {
        try {
          const data = await fetchLesson(lessonParam);
          setSessionId(data.session.id);
          setWorkspaceId(data.session.workspace_id);
          setLessonTitle(data.session.prompt);
          setBlocks(data.blocks.map((b) => b.block));
          setPlan(data.plan || []);
          setSpokenUpTo(data.blocks.length - 1);
          setStatus("live");
        } catch {
          setStatus("reconnecting");
          setSessionId(lessonParam);
          setError("Connection lost — rejoin to pick up where you left off.");
        }
        return;
      }

      // Resolve workspace (assigned or own)
      let wsId: string | null = workspaceIdParam;
      let wsTitle = topic || "New lesson";
      if (wsId) {
        const { data: ws } = await supabase.from("workspaces").select("id, title, user_id").eq("id", wsId).single();
        if (ws) {
          wsTitle = topic || ws.title;
          if (ws.user_id !== userId) {
            const { data: existing } = await supabase
              .from("class_memberships")
              .select("id")
              .eq("workspace_id", ws.id)
              .eq("student_id", userId)
              .maybeSingle();
            if (!existing) {
              await supabase.from("class_memberships").insert({ workspace_id: ws.id, student_id: userId });
            }
          }
        } else {
          wsId = null;
        }
      }
      if (!wsId) {
        const { data: workspaces } = await supabase.from("workspaces").select("id, title").eq("user_id", userId).limit(1);
        if (workspaces && workspaces.length > 0) {
          wsId = workspaces[0].id;
          wsTitle = topic || workspaces[0].title;
        } else {
          const { data: newWs, error: wsErr } = await supabase
            .from("workspaces")
            .insert({ title: wsTitle, subject: "General", grade: "9", user_id: userId })
            .select("id, title")
            .single();
          if (wsErr || !newWs) {
            setError(wsErr?.message || "Could not create workspace");
            return;
          }
          wsId = newWs.id;
        }
      }
      setWorkspaceId(wsId);
      setLessonTitle(wsTitle);

      // Upload a PDF attached on the home screen, if any
      const pending = takePendingMaterial();
      if (pending && wsId) {
        try {
          const res = await uploadPdf(wsId, pending);
          setSources((prev) => [...prev, { id: res.source_id, file_name: pending.name, file_hash: res.file_hash }]);
        } catch {
          // Non-fatal: lesson can still run without the material
        }
      }

      // Start the lesson from the topic prompt
      if (topic) startLesson(wsId!, topic);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load sources for the Material drawer
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

  // Progress tracking for the teacher heatmap
  const lastTaskRef = useRef<string>("");
  useEffect(() => {
    for (let i = blocks.length - 1; i >= 0; i--) {
      if (blocks[i]?.kind === "task") {
        lastTaskRef.current = blocks[i].text || "";
        break;
      }
    }
  }, [blocks]);

  const recordProgressRef = useRef<((correct: boolean) => void) | null>(null);
  useEffect(() => {
    recordProgressRef.current = (correct: boolean) => {
      (async () => {
        if (!workspaceId) return;
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) return;
        const task = lastTaskRef.current || lessonTitle;
        const nodeId = `lesson:${task.toLowerCase().slice(0, 60).replace(/[^a-z0-9а-яёәіңғүұқөһ]+/gi, "-")}`;
        await supabase.from("student_progress").insert({
          student_id: userData.user.id,
          workspace_id: workspaceId,
          node_id: nodeId,
          status: correct ? "completed" : "failed",
          error_count: correct ? 0 : 1,
        });
      })();
    };
  }, [workspaceId, lessonTitle, supabase]);

  // Abort the stream when leaving the page
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // Group blocks into left-to-right columns, one per lesson-plan step.
  // Blocks without a "step" (e.g. the student echo) join the current step.
  // `start` remembers each step's first global block index so reveal can
  // compare against the global speaking key.
  const columns: { blocks: LessonBlock[]; start: number }[] = [];
  let runningStep = 0;
  blocks.forEach((b, gi) => {
    const s = b.step ?? runningStep;
    runningStep = Math.max(runningStep, s);
    const col = (columns[s] = columns[s] || { blocks: [], start: gi });
    col.blocks.push(b);
  });
  const currentStep = runningStep;

  // -------------------------------------------------------------------------
  // Board panning (infinite canvas)
  // -------------------------------------------------------------------------
  // Center a plan step's column in the viewport (used by auto-follow, the
  // plan bar, and the "Follow Lumi" pill).
  const centerOn = useCallback((step: number, yRatio = 0.35) => {
    const vp = boardRef.current;
    if (!vp) return;
    const col = vp.querySelector(`[data-step="${step}"]`) as HTMLElement | null;
    const vr = vp.getBoundingClientRect();
    if (col) {
      const cr = col.getBoundingClientRect();
      setPan((p) => ({
        x: p.x + vr.left + vr.width / 2 - (cr.left + cr.width / 2),
        y: p.y + vr.top + vr.height * yRatio - cr.top,
      }));
    }
  }, []);

  // Follow Lumi: keep the current step centered as the lesson streams in.
  useEffect(() => {
    if (!follow) return;
    centerOn(currentStep);
  }, [blocks, follow, currentStep, zoom, centerOn]);

  // Drag-to-pan like a whiteboard app — the board is an infinite canvas.
  const onPointerDown = (e: React.PointerEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest("button, input, a, textarea, label")) return;
    if (e.button !== 0) return;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPanX: pan.x,
      startPanY: pan.y,
      active: false,
    };
    try {
      boardRef.current?.setPointerCapture(e.pointerId);
    } catch {
      // pointer capture may be unavailable — panning still works
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.active && Math.hypot(dx, dy) > 4) {
      drag.active = true;
      setDragging(true);
      setFollow(false);
    }
    if (drag.active) {
      e.preventDefault();
      setPan({ x: drag.startPanX + dx, y: drag.startPanY + dy });
    }
  };

  const onPointerUp = () => {
    dragRef.current = null;
    setDragging(false);
  };

  // Make the canvas scroll-compatible: wheel/trackpad pans it in both axes
  // (shift+wheel or a horizontal wheel scrolls sideways), ctrl/cmd+wheel zooms.
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      setZoom((z) => Math.min(1.6, Math.max(0.6, Math.round(z * factor * 10) / 10)));
      return;
    }
    let dx = e.deltaX;
    let dy = e.deltaY;
    if (e.shiftKey && dx === 0) {
      dx = dy;
      dy = 0;
    }
    if (e.deltaMode === 1) {
      dx *= 16;
      dy *= 16;
    }
    setPan((p) => ({ x: p.x - dx, y: p.y - dy }));
    setFollow(false);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !workspaceId) return;
    setUploading(true);
    try {
      const res = await uploadPdf(workspaceId, file);
      setSources((prev) => [...prev.filter((s) => s.id !== res.source_id), { id: res.source_id, file_name: file.name, file_hash: res.file_hash }]);
    } catch (err: unknown) {
      setError(errorMessage(err, "Upload failed"));
    } finally {
      setUploading(false);
    }
  };

  const endLesson = () => {
    abortRef.current?.abort();
    stopSpeech();
    router.push("/");
  };

  const handleSend = () => {
    const text = inputText.trim();
    if (!text) return;
    setInputText("");
    if (sessionId) {
      sendStudentMessage(text);
    } else if (workspaceId && !streaming) {
      // No lesson yet — this message IS the lesson prompt
      setLessonTitle(text);
      startLesson(workspaceId, text);
    }
  };

  // Is the ball in the student's court? (last block is an unanswered task)
  const awaitingStudent = (() => {
    for (let i = blocks.length - 1; i >= 0; i--) {
      const k = blocks[i]?.kind;
      if (k === "task") return !streaming;
      if (k === "student") return false;
    }
    return false;
  })();

  // When Lumi hands the board over to the student, focus the input box so the
  // answer can be typed straight away.
  useEffect(() => {
    if (awaitingStudent && !streaming) messageInputRef.current?.focus();
  }, [awaitingStudent, streaming]);

  // -------------------------------------------------------------------------
  // Block rendering
  // -------------------------------------------------------------------------
  const materialTag = (
    <span className="inline-block align-middle ml-3 bg-foreground text-background text-[10px] font-sans font-medium px-2 py-0.5 rounded-sm">
      Your material
    </span>
  );

  const renderBlock = (block: LessonBlock, idx: number) => {
    const speaking = speakingKey === idx;
    const glow = speaking ? "bg-board-task/40 -mx-3 px-3 rounded" : "";
    // How much of this block is "written" on the board (0..1). Blocks with a
    // spoken line are revealed as the audio plays: hidden until Lumi starts
    // speaking, filled in progressively while speaking, complete once spoken.
    let prog = 1;
    if (block.speak) {
      const alreadySpoken =
        (speakingKey !== null && idx < speakingKey) ||
        (speakingKey === null && idx <= spokenUpTo);
      if (alreadySpoken) prog = 1;
      else if (idx === speakingKey) prog = captionProg;
      else prog = 0;
    }
    switch (block.kind) {
      case "section":
        return (
          <div key={idx} className={`animate-board-in pt-6 text-center ${glow}`}>
            <h2 className="font-board-serif text-3xl md:text-4xl font-bold text-foreground">
              {block.title}
              {block.material && materialTag}
            </h2>
            <div className="h-[3px] bg-board-line mt-1 w-full max-w-md mx-auto" />
          </div>
        );
      case "subsection":
        return (
          <div key={idx} className={`animate-board-in pt-8 text-center ${glow}`}>
            <h3 className="font-board-serif text-xl md:text-2xl font-semibold text-foreground inline-block border-b-[3px] border-board-accent pb-0.5">
              {block.title}
              {block.material && materialTag}
            </h3>
          </div>
        );
      case "note": {
        const t = block.text ? block.text.slice(0, Math.round(block.text.length * prog)) : "";
        if (!t) return null;
        return (
          <p key={idx} className={`animate-board-in font-hand text-lg leading-relaxed text-foreground text-center ${glow}`}>
            {t}
            {block.material && materialTag}
          </p>
        );
      }
      case "formula": {
        const t = block.text ? block.text.slice(0, Math.round(block.text.length * prog)) : "";
        if (!t) return null;
        return (
          <div key={idx} className={`animate-board-in py-3 text-center ${glow}`}>
            <span className="font-board-serif italic text-2xl md:text-3xl text-foreground tracking-wide">{t}</span>
          </div>
        );
      }
      case "bullets": {
        const shown = (block.items || []).slice(0, Math.max(1, Math.ceil((block.items || []).length * prog)));
        if (prog === 0) return null;
        return (
          <div key={idx} className={`animate-board-in space-y-1.5 ${glow}`}>
            {shown.map((item, i) => (
              <div key={i} className="flex gap-3 font-hand text-lg leading-relaxed text-foreground">
                <span className="text-muted select-none">·</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        );
      }
      case "steps": {
        const shown = (block.items || []).slice(0, Math.max(1, Math.ceil((block.items || []).length * prog)));
        if (prog === 0) return null;
        return (
          <div key={idx} className={`animate-board-in space-y-1.5 ${glow}`}>
            {shown.map((item, i) => (
              <div key={i} className="flex gap-3 font-hand text-lg leading-relaxed text-foreground">
                <span className="font-board-serif font-semibold select-none">{i + 1})</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        );
      }
      case "table": {
        const columns = block.table?.columns || [];
        const allRows = block.table?.rows || [];
        if (prog === 0 || allRows.length === 0) return null;
        const shownRows = allRows.slice(0, Math.max(1, Math.ceil(allRows.length * prog)));
        return (
          <div key={idx} className={`animate-board-in ${glow}`}>
            <table className="w-full border-collapse text-sm font-hand text-foreground">
              {columns.length > 0 && (
                <thead>
                  <tr>
                    {columns.map((c, i) => (
                      <th
                        key={i}
                        className="border border-board-line bg-board-task/30 px-3 py-1.5 text-left font-semibold"
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody>
                {shownRows.map((r, ri) => (
                  <tr key={ri}>
                    {r.map((cell, ci) => (
                      <td key={ci} className="border border-board-line px-3 py-1.5 align-top">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      case "diagram": {
        const nodes = block.diagram?.nodes || [];
        if (prog === 0 || nodes.length === 0) return null;
        const shown = Math.max(1, Math.ceil(nodes.length * prog));
        const visNodes = nodes.slice(0, shown);
        const visIds = new Set(visNodes.map((n) => n.id));
        const allEdges = (block.diagram?.edges || []).filter(
          (e) => Array.isArray(e) && e.length >= 2
        ) as [string, string, string?][];
        const visEdges = allEdges.filter(([s, t]) => visIds.has(s) && visIds.has(t));

        // Layer nodes left-to-right by graph depth (iterative, cycle-safe).
        const depths: Record<string, number> = {};
        nodes.forEach((n) => (depths[n.id] = 0));
        for (let i = 0; i < nodes.length; i++) {
          allEdges.forEach(([s, t]) => {
            depths[t] = Math.max(depths[t] ?? 0, (depths[s] ?? 0) + 1);
          });
        }

        const NODE_W = 96;
        const NODE_H = 42;
        const GAP_X = 14;
        const GAP_Y = 24;
        const PAD = 16;

        const cols = new Map<number, typeof visNodes>();
        visNodes.forEach((n) => {
          const d = depths[n.id] ?? 0;
          if (!cols.has(d)) cols.set(d, []);
          cols.get(d)!.push(n);
        });
        const colHeights = [...cols.entries()].map(([d, ns]) => ({ d, h: ns.length * (NODE_H + GAP_Y) }));
        const maxColH = Math.max(NODE_H, ...colHeights.map((c) => c.h));
        const maxDepth = Math.max(0, ...[...cols.keys()]);
        const pos = new Map<string, { x: number; y: number }>();
        colHeights.forEach(({ d, h }) => {
          const startY = PAD + (maxColH - h) / 2;
          (cols.get(d) || []).forEach((n, i) => {
            pos.set(n.id, { x: PAD + d * (NODE_W + GAP_X), y: startY + i * (NODE_H + GAP_Y) });
          });
        });
        const W = PAD * 2 + maxDepth * (NODE_W + GAP_X) + NODE_W;
        const H = PAD * 2 + maxColH;

        const pathFor = (s: { x: number; y: number }, t: { x: number; y: number }) => {
          const sx = s.x + NODE_W / 2;
          const sy = s.y + NODE_H;
          const tx = t.x + NODE_W / 2;
          const ty = t.y;
          const midY = Math.max(sy + 10, (sy + ty) / 2);
          return {
            d: `M ${sx} ${sy} L ${sx} ${midY} L ${tx} ${midY} L ${tx} ${ty}`,
            labelX: (sx + tx) / 2,
            labelY: midY - 4,
          };
        };

        return (
          <div key={idx} className={`animate-board-in ${glow}`}>
            <svg
              viewBox={`0 0 ${W} ${H}`}
              style={{ width: W, maxWidth: "100%", height: "auto" }}
              className="text-foreground"
            >
              {visEdges.map((e, i) => {
                const s = pos.get(e[0]);
                const t = pos.get(e[1]);
                if (!s || !t) return null;
                const { d, labelX, labelY } = pathFor(s, t);
                return (
                  <g key={i}>
                    <path d={d} fill="none" strokeWidth={1.5} className="stroke-foreground/50" />
                    {e[2] ? (
                      <text x={labelX} y={labelY} textAnchor="middle" fontSize={10} className="fill-muted">
                        {e[2]}
                      </text>
                    ) : null}
                  </g>
                );
              })}
              {visNodes.map((n) => {
                const p = pos.get(n.id);
                if (!p) return null;
                const cx = p.x + NODE_W / 2;
                const cy = p.y + NODE_H / 2;
                let shape: React.ReactNode;
                if (n.shape === "decision") {
                  shape = (
                    <polygon
                      points={`${cx},${p.y + 4} ${p.x + NODE_W - 4},${cy} ${cx},${p.y + NODE_H - 4} ${p.x + 4},${cy}`}
                      strokeWidth={1.5}
                      className="fill-board-task/40 stroke-foreground/60"
                    />
                  );
                } else if (n.shape === "start" || n.shape === "end") {
                  shape = (
                    <ellipse
                      cx={cx}
                      cy={cy}
                      rx={NODE_W / 2 - 5}
                      ry={NODE_H / 2 - 5}
                      strokeWidth={1.5}
                      className="fill-board-accent/25 stroke-foreground/60"
                    />
                  );
                } else {
                  shape = (
                    <rect
                      x={p.x}
                      y={p.y}
                      width={NODE_W}
                      height={NODE_H}
                      rx={7}
                      strokeWidth={1.5}
                      className="fill-surface stroke-foreground/60"
                    />
                  );
                }
                return (
                  <g key={n.id}>
                    {shape}
                    <text x={cx} y={cy + 4} textAnchor="middle" fontSize={12} className="fill-foreground font-hand">
                      {n.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        );
      }
      case "task": {
        const isOpen = awaitingStudent && idx === blocks.length - 1 && prog === 1;
        const t = block.text ? block.text.slice(0, Math.round(block.text.length * prog)) : "";
        if (!t) return null;
        return (
          <div key={idx} className={`animate-board-in pt-4 ${glow}`}>
            <div className={`inline-block max-w-full bg-board-task/70 px-4 py-3 rounded-sm ${isOpen ? "ring-1 ring-foreground/20" : ""}`}>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted mb-1">
                Your turn{isOpen ? " — answer in the box below" : ""}
              </div>
              <div className="font-hand text-lg leading-relaxed text-foreground">{t}</div>
            </div>
          </div>
        );
      }
      case "choice": {
        const title = block.title || "Where would you like to go next?";
        return (
          <div key={idx} className={`animate-board-in pt-4 ${glow}`}>
            <div className="inline-block max-w-full bg-board-task/70 px-4 py-3 rounded-sm">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted mb-1">
                Where to go next
              </div>
              <div className="font-hand text-lg leading-relaxed text-foreground">{title}</div>
              <div className="flex flex-wrap gap-2 mt-3">
                {(block.options || []).map((o, i) => (
                  <button
                    key={i}
                    onClick={() => sendStudentMessage(o)}
                    disabled={!sessionId || streaming}
                    className="h-9 px-3.5 bg-foreground text-background rounded-md text-sm disabled:opacity-40 hover:opacity-85 transition-opacity"
                  >
                    {o}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      }
      case "feedback":
        // The student's answer + Lumi's verdict live in the transcript drawer,
        // not on the board — the board stays a clean lesson artifact.
        return null;
      case "student":
        // The student's typed answer is mirrored in the transcript drawer,
        // not on the board.
        return null;
      default:
        return null;
    }
  };

  // -------------------------------------------------------------------------
  // UI
  // -------------------------------------------------------------------------
  return (
    <div className="flex flex-col h-screen w-full bg-board">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2 w-40">
          <span className="w-4 h-4 rounded-full bg-gradient-to-br from-primary to-secondary inline-block" />
          <span className="font-semibold text-lg tracking-tight">lumi</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted">
          {status === "live" && (
            <>
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
              Live
            </>
          )}
          {status === "connecting" && (
            <>
              <Loader2 size={13} className="animate-spin" />
              {blocks.length === 0 ? "Preparing your lesson…" : "Connecting…"}
            </>
          )}
          {status === "reconnecting" && (
            <>
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
              Reconnecting…
            </>
          )}
          {status === "idle" && "Ready"}
        </div>
        <div className="flex items-center gap-2 w-40 justify-end">
          <button
            onClick={() => setMaterialOpen(true)}
            className="flex items-center gap-1.5 border border-border rounded-full px-3.5 py-1.5 text-sm text-foreground hover:border-foreground transition-colors"
          >
            <FileText size={14} />
            Material
          </button>
          <button
            onClick={endLesson}
            className="flex items-center gap-1.5 bg-foreground text-background rounded-full px-3.5 py-1.5 text-sm hover:opacity-80 transition-opacity"
          >
            <Square size={11} />
            End
          </button>
        </div>
      </header>

      {/* Reconnect banner */}
      {status === "reconnecting" && (
        <div className="flex items-center justify-between px-5 py-2.5 bg-primary/25 text-sm text-foreground shrink-0">
          <span>{error || "Connection lost — rejoin to pick up where you left off."}</span>
          <button
            onClick={rejoin}
            className="ml-4 border border-foreground rounded-full px-3 py-1 text-xs font-medium hover:bg-foreground hover:text-background transition-colors"
          >
            Rejoin
          </button>
        </div>
      )}
      {error && status !== "reconnecting" && (
        <div className="px-5 py-2 bg-red-50 border-b border-red-200 text-sm text-red-700 shrink-0">{error}</div>
      )}

      {/* Plan — one chip per lesson step, always visible above the board */}
      {plan.length > 0 && (
        <div className="flex items-center gap-2 px-5 py-2 border-b border-border bg-board shrink-0 overflow-x-auto">
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-muted mr-1">
            Plan
          </span>
          {plan.map((p, i) => (
            <button
              key={i}
              onClick={() => centerOn(i)}
              className={`shrink-0 rounded-full px-3.5 py-1 text-sm border font-medium transition-colors ${
                i === currentStep
                  ? "bg-foreground text-background border-foreground"
                  : i < currentStep
                    ? "border-border text-muted hover:text-foreground hover:border-foreground"
                    : "border-border text-foreground hover:border-foreground"
              }`}
            >
              {i + 1}. {p.title}
            </button>
          ))}
        </div>
      )}

      {/* Board — an infinite canvas, grab and drag to pan in any direction */}
      <div className="relative flex-1 min-h-0 overflow-hidden">
        <div
          ref={boardRef}
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={onPointerUp}
          className={`h-full w-full [touch-action:none] ${dragging ? "cursor-grabbing select-none" : "cursor-grab"}`}
        >
          <div
            className="w-max min-w-full min-h-full"
            style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}
          >
            <div className="min-h-full pb-32" style={{ zoom }}>
              {blocks.length === 0 && status === "connecting" && (
                <div className="flex items-center justify-center gap-3 text-muted pt-32">
                  <Loader2 size={18} className="animate-spin" />
                  <span className="font-hand text-xl">Lumi is planning your lesson…</span>
                </div>
              )}
              {blocks.length === 0 && status === "idle" && (
                <div className="max-w-xl mx-auto pt-24 space-y-5 text-center">
                  <h2 className="font-board-serif text-3xl font-bold">What do you want to learn?</h2>
                  <p className="font-hand text-lg text-muted leading-relaxed">
                    Ask Lumi anything in the box below — it will plan the lesson, write it on this board
                    step by step, explain it out loud, and practice with you until it sticks.
                  </p>
                </div>
              )}

              {/* Steps — one region per plan step. A step's blocks fill a column of up to
                  6 rows, then flow into the next 440px column, so a long step
                  tiles sideways instead of growing into a tall ribbon. Each
                  block's cell is fixed by its index, so revealed blocks never
                  reflow other columns. */}
              <div className="flex items-start gap-8 px-8">
                {columns.map((col, ci) => (
                  <div
                    key={ci}
                    data-step={ci}
                    className={`py-8 grid grid-flow-col auto-cols-[440px] grid-rows-[repeat(6,auto)] gap-x-8 gap-y-4 ${
                      ci === currentStep ? "bg-board-task/5" : ""
                    }`}
                  >
                    {col.blocks.map((b, i) => (
                      <div key={col.start + i} className="w-[440px]">
                        {renderBlock(b, col.start + i)}
                      </div>
                    ))}
                  </div>
                ))}
                {streaming && blocks.length > 0 && (
                  <div className="shrink-0 px-8 py-8 flex items-center gap-2 text-muted w-[440px]">
                    <Loader2 size={14} className="animate-spin" />
                    <span className="font-hand text-base">Lumi is writing…</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Follow Lumi pill */}
        {!follow && blocks.length > 0 && (
          <button
            onClick={() => setFollow(true)}
            className="absolute top-4 left-1/2 -translate-x-1/2 bg-surface border border-border shadow-sm rounded-full px-4 py-1.5 text-sm font-medium text-foreground hover:border-foreground transition-colors"
          >
            Follow Lumi
          </button>
        )}

        {/* Live caption (what Lumi is saying right now) */}
        {caption && (
          <div
            className={`absolute left-1/2 -translate-x-1/2 max-w-3xl w-[92%] pointer-events-none transition-all ${
              transcriptOpen ? "bottom-[4.5rem]" : "bottom-4"
            }`}
          >
            <div className="bg-foreground/90 text-background text-2xl font-medium leading-snug rounded-2xl px-6 py-3.5 backdrop-blur-sm whitespace-pre-line break-words text-left max-h-44 overflow-y-auto shadow-lg">
              <span>{caption.slice(0, Math.round(caption.length * captionProg))}</span>
              <span className="opacity-45">{caption.slice(Math.round(caption.length * captionProg))}</span>
            </div>
          </div>
        )}

        {/* Transcript drawer */}
        {transcriptOpen && (
          <div className="absolute bottom-0 inset-x-0 max-h-72 overflow-y-auto bg-surface border-t border-border shadow-lg">
            <div className="flex items-center justify-between px-5 py-2.5 border-b border-border sticky top-0 bg-surface">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted">Transcript</span>
              <button onClick={() => setTranscriptOpen(false)} className="text-muted hover:text-foreground">
                <X size={14} />
              </button>
            </div>
            <div className="px-5 py-3 space-y-2.5">
              {blocks.filter((b) => b.kind === "student" || b.speak).length === 0 ? (
                <div className="text-sm text-muted">Nothing said yet.</div>
              ) : (
                blocks.map((b, i) => {
                  if (b.kind === "student") {
                    return (
                      <div key={i} className="text-sm">
                        <span className="font-mono text-[10px] uppercase tracking-widest text-muted mr-2">You</span>
                        {b.text}
                      </div>
                    );
                  }
                  if (b.speak) {
                    return (
                      <div key={i} className="text-sm text-muted">
                        <span className="font-mono text-[10px] uppercase tracking-widest mr-2">Lumi</span>
                        {b.speak}
                      </div>
                    );
                  }
                  return null;
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Input row — text-only conversation with Lumi */}
      <div className="shrink-0 border-t border-border bg-surface px-4 py-3">
        <div className="flex items-center gap-2 max-w-3xl mx-auto">
          <input
            ref={messageInputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder={
              sessionId
                ? awaitingStudent
                  ? "Type your answer…"
                  : "Ask Lumi anything…"
                : "What do you want to learn? e.g. Explain how a neuromorphic chip works"
            }
            className="flex-1 h-11 border border-border rounded-md px-3 text-sm outline-none focus:border-foreground transition-colors bg-background"
          />
          <button
            onClick={handleSend}
            disabled={!inputText.trim() || streaming || (!sessionId && !workspaceId)}
            className="flex items-center justify-center h-11 px-4 bg-foreground text-background rounded-md disabled:opacity-40 hover:opacity-85 transition-opacity"
          >
            <Send size={14} />
          </button>
        </div>
      </div>

      {/* Bottom control bar */}
      <div className="flex items-center gap-3 h-14 px-4 border-t border-border bg-surface shrink-0">
        <span className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-secondary inline-block shrink-0" />
        <button
          onClick={togglePause}
          title={paused ? "Resume" : "Pause"}
          className="flex items-center justify-center w-10 h-10 rounded-full border border-border text-foreground hover:border-foreground transition-colors"
        >
          {paused ? <Play size={15} /> : <Pause size={15} />}
        </button>
        <div className="flex items-center gap-2">
          <button onClick={() => setVolume(volume === 0 ? 0.9 : 0)} className="text-muted hover:text-foreground transition-colors">
            {volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-20 accent-foreground"
          />
        </div>

        <div className="flex-1" />

        {/* Zoom */}
        <div className="hidden sm:flex items-center gap-1 text-muted">
          <button
            onClick={() => setZoom((z) => Math.max(0.6, Math.round((z - 0.1) * 10) / 10))}
            className="w-7 h-7 flex items-center justify-center hover:text-foreground transition-colors"
          >
            <Minus size={14} />
          </button>
          <span className="text-xs font-mono w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom((z) => Math.min(1.6, Math.round((z + 0.1) * 10) / 10))}
            className="w-7 h-7 flex items-center justify-center hover:text-foreground transition-colors"
          >
            <Plus size={14} />
          </button>
        </div>

        <button
          onClick={() => setTranscriptOpen((v) => !v)}
          title="Transcript"
          className={`flex items-center justify-center w-10 h-10 rounded-full border transition-colors ${
            transcriptOpen ? "border-foreground text-foreground" : "border-border text-muted hover:text-foreground"
          }`}
        >
          <MessageSquare size={15} />
        </button>
      </div>

      {/* Material drawer */}
      {materialOpen && (
        <>
          <div className="fixed inset-0 bg-foreground/20 z-40" onClick={() => setMaterialOpen(false)} />
          <div className="fixed top-0 right-0 h-full w-80 bg-surface border-l border-border z-50 flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted">Your material</span>
              <button onClick={() => setMaterialOpen(false)} className="text-muted hover:text-foreground">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || !workspaceId}
                className="flex items-center justify-center gap-2 w-full border border-dashed border-border px-3 py-3 text-sm text-muted hover:text-foreground hover:border-foreground transition-colors disabled:opacity-40"
              >
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {uploading ? "Uploading…" : "Upload PDF"}
              </button>
              <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleUpload} />
              {sources.length === 0 ? (
                <p className="text-xs text-muted leading-relaxed">
                  No materials yet. Upload a PDF and Lumi will ground the lesson in it — blocks based on your
                  documents are tagged “Your material”.
                </p>
              ) : (
                sources.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 border border-border px-3 py-2.5">
                    <FileText size={14} className="text-muted shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm truncate">{s.file_name}</div>
                      <div className="font-mono text-[10px] text-muted">{s.file_hash.slice(0, 8)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
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
