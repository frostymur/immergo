const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function apiFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

export async function uploadPdf(workspaceId: string, file: File) {
  const form = new FormData();
  form.append("workspace_id", workspaceId);
  form.append("file", file);
  return apiFetch("/api/ai/upload-and-index", {
    method: "POST",
    body: form,
  });
}

export async function generatePodcast(workspaceId: string, sourceId: string, lang: string) {
  return apiFetch("/api/ai/generate-podcast", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspace_id: workspaceId, source_id: sourceId, lang }),
  });
}

export async function socraticChat(workspaceId: string, question: string, lang: string) {
  return apiFetch("/api/ai/socratic-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspace_id: workspaceId, question, lang }),
  });
}

export async function socraticAnswer(workspaceId: string, asked: string, answer: string, lang: string) {
  return apiFetch("/api/ai/socratic-answer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspace_id: workspaceId, asked, answer, lang }),
  });
}

export async function fetchSummary(workspaceId: string, sourceId: string, lang: string) {
  return apiFetch("/api/ai/summary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspace_id: workspaceId, source_id: sourceId, lang }),
  });
}

export async function fetchHeatmap(workspaceId: string) {
  return apiFetch(`/api/ai/teacher/heatmap?workspace_id=${encodeURIComponent(workspaceId)}`);
}

// ---------------------------------------------------------------------------
// Diagnostic & Roadmap API
// ---------------------------------------------------------------------------

export type DiagnosticQuestion = {
  q: string;
  options: string[];
  answer: number;
  explain?: string;
  topic?: string;
};

export type DiagnosticResult = {
  correct: number;
  total: number;
  level: "beginner" | "intermediate" | "advanced";
  feedback: string;
  weak_topics: string[];
  recommendation: string;
};

export type Goal = "ent" | "olympiad" | "school";

export async function apiDiagnosticStart(grade: number, subject: string, goal: Goal, lang: string) {
  return apiFetch("/api/ai/diagnostic/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grade, subject, goal, lang }),
  }) as Promise<{ questions: DiagnosticQuestion[] }>;
}

export async function apiDiagnosticEvaluate(
  grade: number,
  subject: string,
  goal: Goal,
  lang: string,
  questions: DiagnosticQuestion[],
  answers: number[]
) {
  return apiFetch("/api/ai/diagnostic/evaluate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grade, subject, goal, lang, questions, answers }),
  }) as Promise<DiagnosticResult>;
}

export type RoadmapStage = {
  title: string;
  topics: string[];
  material: string;
  check: string;
  duration: string;
};

export type RoadmapData = {
  topic: string;
  goal: Goal;
  level: "beginner" | "intermediate" | "advanced";
  stages: RoadmapStage[];
  total_weeks: number;
  deadline: string | null;
  weak_topics: string[];
};

export async function apiRoadmap(
  topic: string,
  goal: Goal,
  lang: string,
  level: string = "intermediate",
  weakTopics: string[] = [],
  grade: string = ""
) {
  return apiFetch("/api/ai/roadmap", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic, goal, lang, level, weak_topics: weakTopics, grade }),
  }) as Promise<RoadmapData>;
}

// ---------------------------------------------------------------------------
// Live lesson (whiteboard) API
// ---------------------------------------------------------------------------

export type LessonBlock = {
  kind:
    | "section"
    | "subsection"
    | "note"
    | "formula"
    | "bullets"
    | "steps"
    | "table"
    | "diagram"
    | "svg"
    | "choice"
    | "task"
    | "feedback"
    | "student";
  title?: string;
  text?: string;
  items?: string[];
  options?: string[];
  speak?: string;
  correct?: boolean;
  material?: boolean;
  step?: number;
  content?: string;
  // Legacy / fallback nested structures
  table?: { columns?: string[]; rows?: string[][] };
  diagram?: {
    nodes?: { id: string; label: string; shape?: "start" | "decision" | "end" }[];
    edges?: [string, string, string?][];
  };
  // Flat properties (what the LLM actually produces)
  columns?: string[];
  rows?: string[][];
  nodes?: { id: string; label: string; shape?: "start" | "decision" | "end" }[];
  edges?: [string, string, string?][];
};

export type LessonPlanStep = {
  title: string;
  detail?: string;
};

export type LessonEvent =
  | { kind: "plan"; steps: LessonPlanStep[] }
  | { kind: "session"; session_id: string; prompt: string }
  | { kind: "block"; idx: number; block: LessonBlock }
  | { kind: "student"; idx: number; block: LessonBlock }
  | { kind: "done" }
  | { kind: "error"; message: string };

export interface LessonStreamHandlers {
  onEvent: (event: LessonEvent) => void;
  onError?: (error: Error) => void;
}

/**
 * Parse a server-sent-event stream from a POST response, dispatching each
 * `data:` payload as a LessonEvent. Resolves when the stream closes.
 */
async function consumeSseStream(res: Response, handlers: LessonStreamHandlers) {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let detail = text;
    try {
      const parsed = JSON.parse(text);
      detail = typeof parsed?.detail === "string" ? parsed.detail : text;
    } catch {
      // keep raw text
    }
    throw new Error(`API ${res.status}: ${detail}`);
  }
  const reader = res.body?.getReader();
  if (!reader) throw new Error("Streaming not supported by this browser");

  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() || "";
    for (const frame of frames) {
      const dataLine = frame
        .split("\n")
        .find((l) => l.startsWith("data:"));
      if (!dataLine) continue;
      try {
        handlers.onEvent(JSON.parse(dataLine.slice(5).trim()) as LessonEvent);
      } catch {
        // Ignore malformed frames
      }
    }
  }
}

export async function streamLessonStart(
  workspaceId: string,
  prompt: string,
  lang: string,
  handlers: LessonStreamHandlers,
  signal?: AbortSignal,
  level: string = "intermediate",
  weakTopics: string[] = []
) {
  try {
    const res = await fetch(`${API_BASE}/api/ai/lesson/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace_id: workspaceId, prompt, lang, level, weak_topics: weakTopics }),
      signal,
    });
    await consumeSseStream(res, handlers);
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") return;
    handlers.onError?.(err instanceof Error ? err : new Error(String(err)));
  }
}

export async function streamLessonMessage(
  sessionId: string,
  text: string,
  handlers: LessonStreamHandlers,
  signal?: AbortSignal
) {
  try {
    const res = await fetch(`${API_BASE}/api/ai/lesson/${sessionId}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal,
    });
    await consumeSseStream(res, handlers);
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") return;
    handlers.onError?.(err instanceof Error ? err : new Error(String(err)));
  }
}

export async function fetchLesson(sessionId: string): Promise<{
  session: { id: string; workspace_id: string; prompt: string; lang: string; status: string };
  plan: LessonPlanStep[];
  blocks: Array<{ idx: number; block: LessonBlock }>;
}> {
  return apiFetch(`/api/ai/lesson/${sessionId}`);
}

export type TtsVoice = { id: string; name: string; gender: string; accent?: string };
export type TtsVoices = Record<"kz" | "ru" | "en", TtsVoice[]>;

export async function fetchTtsAudio(text: string, lang: string, voice?: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}/api/ai/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, lang, voice }),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`TTS ${res.status}: ${msg}`);
  }
  return res.blob();
}

export async function fetchTtsVoices(): Promise<TtsVoices> {
  const res = await fetch(`${API_BASE}/api/ai/tts/voices`);
  if (!res.ok) throw new Error(`Voices ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Teacher class analytics
// ---------------------------------------------------------------------------

export type DiagnosticHistoryItem = {
  subject: string;
  correct: number;
  total: number;
  pct: number | null;
  level: string | null;
  created_at: string;
};

export type StudentReadiness = {
  user_id: string;
  email: string | null;
  subject: string | null;
  correct: number | null;
  total: number | null;
  pct: number | null;
  level: string | null;
  completed: number;
  failed: number;
  assignments_done: number;
  assignments_total: number;
  roadmap_done: number;
  roadmap_total: number;
  readiness_score: number | null;
  readiness: "ready" | "on_track" | "at_risk" | "no_data";
  diagnostics: DiagnosticHistoryItem[];
};

export type TopicMastery = {
  topic: string;
  students: number;
  correct: number;
  total: number;
  pct: number;
};

export type ClassAnalytics = {
  workspace_id: string;
  subjects: string[];
  students: StudentReadiness[];
  topics: TopicMastery[];
};

export async function fetchClassAnalytics(workspaceId: string, subject?: string | null): Promise<ClassAnalytics> {
  const params = new URLSearchParams({ workspace_id: workspaceId });
  if (subject) params.set("subject", subject);
  return apiFetch(`/api/ai/teacher/class-analytics?${params.toString()}`);
}

// ---------------------------------------------------------------------------
// Highlight API
// ---------------------------------------------------------------------------

export type HighlightColor = "yellow" | "green" | "blue" | "pink";

export type Highlight = {
  id: string;
  session_id: string;
  block_idx: number;
  selected_text: string;
  color: HighlightColor;
  created_at: string;
};

export async function saveHighlight(
  sessionId: string,
  blockIdx: number,
  selectedText: string,
  color: HighlightColor
): Promise<Highlight> {
  return apiFetch(`/api/ai/lesson/${sessionId}/highlight`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ block_idx: blockIdx, selected_text: selectedText, color }),
  });
}

export async function deleteHighlight(sessionId: string, highlightId: string): Promise<void> {
  await apiFetch(`/api/ai/lesson/${sessionId}/highlight/${highlightId}`, {
    method: "DELETE",
  });
}

export async function fetchHighlights(sessionId: string): Promise<Highlight[]> {
  return apiFetch(`/api/ai/lesson/${sessionId}/highlights`);
}
